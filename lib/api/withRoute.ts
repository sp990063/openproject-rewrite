/**
 * withRoute — Higher-Order Function for Next.js Pages Router API routes
 * =====================================================================
 *
 * Single ingress for every authenticated/validated API endpoint in the
 * OpenProject Rewrite v2 codebase. Wraps a typed handler in a 7-stage
 * pipeline so individual route files can focus on business logic:
 *
 *   1. Logging     — stamps X-Request-Id + duration log
 *   2. Auth        — getServerSession(req, res, authOptions) 3-arg
 *   3. Rate limit  — Upstash Ratelimit (or ioredis fallback), per user > per IP
 *   4. Validation  — Zod schemas for body / query / params (optional)
 *   5. RBAC        — custom permission check (optional, async)
 *   6. Handler     — your typed business logic
 *   7. Error/Sentry/audit — uniform error envelope + Sentry capture + audit log
 *
 * @see revamp-v2/design/03-backend-api.md §11  (Middleware Pipeline)
 * @see revamp-v2/design/11-migration-plan.md Phase 1  (withRoute HOF)
 */

import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, type Session } from 'next-auth'
import { z, ZodError, type ZodSchema } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'
import { logApiRequest } from '@/lib/api-logger'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Permissive row in `req.query` — Pages Router types vary too much. */
export type QueryParams = Record<string, string | string[] | undefined>

/** Path params populated by Next.js (e.g. `[projectId]`, `[slug]`). */
export type PathParams = Record<string, string | string[] | undefined>

/** Validated, typed request body. */
export type TBody = unknown

/** Validated, typed request query string. */
export type TQuery = QueryParams

/** Validated, typed path params. */
export type TParams = PathParams

/**
 * A session augmented with the standard OpenProject user fields we care about.
 * Re-uses the augmented `Session` from `next-auth` defined in `lib/auth.ts`.
 */
export type RouteSession = Session

/**
 * The handler the user writes. Receives a fully-validated, authenticated
 * request and a typed payload extracted from body / query / params.
 */
export type RouteHandler<TBody, TQuery, TParams> = (ctx: {
  req: NextApiRequest
  res: NextApiResponse
  session: RouteSession
  body: TBody
  query: TQuery
  params: TParams
}) => Promise<unknown> | unknown

/**
 * Optional per-route configuration. All fields are optional; sensible
 * defaults match the most common case (auth required, no rate limit
 * override, no body validation, no RBAC).
 */
export interface RouteConfig<TBody, TQuery, TParams> {
  /** HTTP methods this handler responds to. Defaults to any. */
  methods?: string[]

  /** Zod schema for the request body. Skipped if omitted. */
  bodySchema?: ZodSchema<TBody>

  /** Zod schema for the query string. Skipped if omitted. */
  querySchema?: ZodSchema<TQuery>

  /** Zod schema for the dynamic path params (`req.query`). Skipped if omitted. */
  paramsSchema?: ZodSchema<TParams>

  /**
   * RBAC / permission check. Receives the authenticated session and must
   * return `true` to allow the request, or a `{ status, code, message }`
   * object describing the denial. Defaults to allow-all (auth still runs).
   */
  rbac?: (session: RouteSession, ctx: {
    req: NextApiRequest
    body: TBody
    query: TQuery
    params: TParams
  }) => Promise<boolean | { status: number; code: string; message: string }>

  /**
   * If `true`, allow requests without a session (e.g. /api/health, webhooks).
   * Defaults to `false`.
   */
  public?: boolean

  /**
   * Override the rate-limit identifier. By default we use
   * `user:${session.user.id}` if authenticated, falling back to the
   * client IP. Return a string to override.
   */
  rateLimitKey?: (ctx: {
    req: NextApiRequest
    session: RouteSession | null
  }) => string

  /**
   * Custom audit-log writer. Called after a successful (2xx) response.
   * Defaults to `logApiRequest` (Pino-style console).
   */
  auditLog?: (ctx: {
    method: string
    path: string
    statusCode: number
    duration: number
    userId?: string
  }) => void

  /**
   * Suppress Sentry capture for a particular error class. Useful for
   * `ZodError` (already a 400) or `ApiError` you control.
   */
  skipSentryFor?: (err: unknown) => boolean
}

/** Uniform error envelope returned to clients. */
export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** Internal error class used by handlers / helpers. */
export class ApiError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Pull a usable client identifier for rate limiting. */
function getClientIp(req: NextApiRequest): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim()
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]
  return req.socket?.remoteAddress ?? 'unknown'
}

/** Get or mint a request correlation id. */
function getRequestId(req: NextApiRequest, res: NextApiResponse): string {
  const incoming = req.headers['x-request-id']
  if (typeof incoming === 'string' && incoming.length > 0) return incoming
  const id =
    'req_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 10)
  res.setHeader('X-Request-Id', id)
  return id
}

/** Shape an `ApiError` (or unknown) into the public envelope. */
function formatErrorBody(err: unknown): ApiErrorBody {
  if (err instanceof ApiError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    }
  }
  if (err instanceof ZodError) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
      },
    }
  }
  // Last resort: never leak the raw `.message` of a non-ApiError in prod.
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err instanceof Error
            ? err.message
            : String(err),
    },
  }
}

// ---------------------------------------------------------------------------
// The HOF
// ---------------------------------------------------------------------------

/**
 * Wrap a typed handler with the standard pipeline.
 *
 * @example
 *
 * ```ts
 * // pages/api/projects/index.ts
 * import { z } from 'zod'
 * import { withRoute, ApiError } from '@/lib/api/withRoute'
 *
 * const createProjectSchema = z.object({
 *   name: z.string().min(1).max(255),
 *   identifier: z.string().regex(/^[a-z0-9-_]+$/),
 *   description: z.string().optional(),
 * })
 *
 * export default withRoute<z.infer<typeof createProjectSchema>, unknown, unknown>(
 *   async ({ req, res, session, body }) => {
 *     // session.user is guaranteed to exist (unless `public: true`)
 *     if (!session.user.isSystemAdmin) {
 *       throw new ApiError(403, 'FORBIDDEN', 'System admin required')
 *     }
 *     const project = await prisma.project.create({ data: body })
 *     return res.status(201).json(project)
 *   },
 *   {
 *     methods: ['GET', 'POST'],
 *     bodySchema: createProjectSchema,            // only validates POST bodies
 *     rbac: async (session) =>
 *       session.user.isSystemAdmin
 *         ? true
 *         : { status: 403, code: 'FORBIDDEN', message: 'Admin only' },
 *   }
 * )
 * ```
 */
export function withRoute<TBody = unknown, TQuery = QueryParams, TParams = PathParams>(
  handler: RouteHandler<TBody, TQuery, TParams>,
  config: RouteConfig<TBody, TQuery, TParams> = {}
): NextApiHandler {
  return async (req, res) => {
    const start = Date.now()
    const requestId = getRequestId(req, res)
    const method = req.method ?? 'UNKNOWN'
    const path = req.url ?? 'unknown'

    // 1. Method allow-list (405 if not in the list)
    if (config.methods && config.methods.length > 0) {
      if (!method || !config.methods.includes(method.toUpperCase())) {
        res.setHeader('Allow', config.methods.join(', '))
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${method} not allowed` },
        })
      }
    }

    try {
      // 2. Auth (3-arg form — the only one that works in nested route contexts)
      let session: RouteSession | null = null
      if (!config.public) {
        session = await getServerSession(req, res, authOptions)
        if (!session?.user?.id) {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          })
        }
      } else {
        session = await getServerSession(req, res, authOptions)
      }

      // 3. Rate limit (skipped in test env, like the rest of the codebase)
      if (process.env.NODE_ENV !== 'test') {
        const key = config.rateLimitKey
          ? config.rateLimitKey({ req, session })
          : session?.user?.id
            ? `user:${session.user.id}`
            : `ip:${getClientIp(req)}`
        const allowed = await checkRateLimit(key)
        if (!allowed) {
          return res.status(429).json({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests' },
          })
        }
      }

      // 4. Validation
      let body = req.body as TBody
      let query = req.query as TQuery
      let params = req.query as TParams

      if (config.bodySchema) {
        body = config.bodySchema.parse(req.body) as TBody
      }
      if (config.querySchema) {
        query = config.querySchema.parse(req.query) as TQuery
      }
      if (config.paramsSchema) {
        params = config.paramsSchema.parse(req.query) as TParams
      }

      // 5. RBAC
      if (config.rbac && session) {
        const verdict = await config.rbac(session, { req, body, query, params })
        if (verdict !== true && verdict !== false) {
          return res.status(verdict.status).json({
            success: false,
            error: { code: verdict.code, message: verdict.message },
          })
        }
      }

      // 6. Handler
      const result = await handler({
        req,
        res,
        session: session as RouteSession,
        body,
        query,
        params,
      })

      // 7a. Audit log
      const duration = Date.now() - start
      const statusCode = res.statusCode >= 400 ? res.statusCode : 200
      if (config.auditLog) {
        config.auditLog({ method, path, statusCode, duration, userId: session?.user?.id })
      } else {
        logApiRequest({ method, path, statusCode, duration, userId: session?.user?.id })
      }

      return result
    } catch (err) {
      // 7b. Error formatter + Sentry + audit
      const duration = Date.now() - start
      const skipSentry = config.skipSentryFor ? config.skipSentryFor(err) : false
      if (!skipSentry && process.env.NODE_ENV === 'production') {
        Sentry.captureException(err, { tags: { requestId, method, path } })
      }
      const body = formatErrorBody(err)
      const status = err instanceof ApiError ? err.status : 500
      logApiRequest({
        method,
        path,
        statusCode: status,
        duration,
        userId: undefined,
        error: body.error.code,
      })
      return res.status(status).json(body)
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience: throw `ApiError(...)` from inside a handler to short-circuit
// with a typed HTTP status (e.g. `throw new ApiError(404, 'NOT_FOUND', ...)`).
// ---------------------------------------------------------------------------

export default withRoute
