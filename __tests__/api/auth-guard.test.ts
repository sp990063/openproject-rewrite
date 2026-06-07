// __tests__/api/auth-guard.test.ts
// =====================================================================
// Phase 7 Sprint D — E2E auth guard
//
// Whole-tree regression guard: for every route in pages/api/, verify
// that an UNauthenticated request returns 401 (or, for public-by-design
// routes, the expected public status code).
//
// This is the "no A5" insurance policy — every new route added by a
// future phase must be either (a) auth-gated (passes the test) or
// (b) added to PUBLIC_ROUTES with a justification. Forgetting either
// will fail this test loudly.
//
// Design:
//   1. AUTO-DISCOVER routes from pages/api/**/*.ts (filesystem scan)
//   2. For each route, generate a path with synthetic IDs ([id] → test123)
//   3. Probe every common HTTP method (GET/POST/PUT/PATCH/DELETE)
//   4. Assert 401 for protected routes, 200/4xx/5xx for public allow-list
//
// Integration test (requires running dev server on TEST_API_URL, default
// http://localhost:3001). Excluded from default `npm test` — run via
// `npm run test:integration` or CI integration job.

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Use native node fetch explicitly (jsdom env can override)
const nodeFetch = globalThis.fetch
const BASE = process.env.TEST_API_URL || 'http://localhost:3001'
const PAGES_API = path.resolve(__dirname, '../../pages/api')

// Routes that are PUBLIC by design — must NOT return 401.
// If you add a new public route, add it here WITH A JUSTIFICATION.
// Anything not in this list is expected to return 401 without auth.
//
// Note: paths here are AFTER the test's [param] → test123 substitution,
// so [id] becomes test123, [...nextauth] becomes test123.
const PUBLIC_ROUTES = new Set<string>([
  // NextAuth — entry point, all methods are part of the OAuth flow
  '/api/auth/test123', // [...nextauth] catch-all
  // /api/auth/2fa/* are protected; only the NextAuth catch-all is public
  '/api/auth/ldap', // also public: triggers LDAP login attempt, returns 401 itself on bad creds

  // Health & metrics — uptime probes & Prometheus scrape
  '/api/health',
  '/api/metrics',

  // CSP violation sink — browsers POST reports, no auth possible
  '/api/csp-report',

  // Cron — bearer CRON_SECRET auth (not session)
  '/api/cron/process-email-queue',

  // OpenProject v3 API version info (GET only)
  '/api/v3',

  // Read-only reference data (no PII, used by login + form dropdowns)
  '/api/statuses',
  '/api/types',
  '/api/priorities',
  '/api/roles',

  // Announcements — banners are public; admin actions gated by real auth
  // (we test POST/PUT/DELETE separately in the loop below; GET is public)
  // /api/announcements — handled by per-method check, not in this set
  '/api/announcements/dismiss', // client-side localStorage placeholder (no-op)
])

// Public GET methods on otherwise-protected routes (e.g. announcements banners)
const PUBLIC_GET_ROUTES = new Set<string>([
  '/api/announcements', // site-wide banner, visible to all
  '/api/work-packages/test123', // Phase 0 design: WP detail page is public-readable (project visibility enforced elsewhere)
])

// Result type for a single probe (route × method combination)
type ProbeResult = {
  route: string
  method: string
  expected: number | number[]
  actual: number
  error?: string
}

// Common HTTP methods to probe
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

// Convert a pages/api file path to an /api URL path
function fileToApiPath(file: string): string {
  let p = file
    .replace(PAGES_API, '')
    .replace(/\/index\.ts$/, '')
    .replace(/\.ts$/, '')
    .replace(/\[([^\]]+)\]/g, 'test123') // [id] → test123, [...slug] → test123
  if (!p.startsWith('/')) p = '/' + p
  return '/api' + p
}

// Discover all API route files (recursively)
function discoverRoutes(): string[] {
  const routes: string[] = []
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        routes.push(fileToApiPath(full))
      }
    }
  }
  walk(PAGES_API)
  return routes.sort()
}

let routes: string[] = []
let serverAvailable = false

beforeAll(async () => {
  routes = discoverRoutes()
  // Probe health endpoint to confirm server is up.
  // Use 10s timeout — dev server cold compile can take several seconds
  // for the first request to a route (Next.js compiles on-demand).
  try {
    const r = await nodeFetch(`${BASE}/api/health?live=1`, {
      signal: AbortSignal.timeout(10000),
    })
    serverAvailable = r.status === 200
  } catch (e) {
    console.warn(`Auth-guard health probe failed: ${e}`)
    serverAvailable = false
  }
})

describe('Auth guard — whole-tree P0 regression', () => {
  it('discovered route count is reasonable (sanity check)', () => {
    // If this fails, the file-tree scan broke (added/removed pages/api dir?)
    expect(routes.length).toBeGreaterThan(50)
    expect(routes.length).toBeLessThan(300)
  })

  it(
    'every non-public route returns 401 without auth',
    async () => {
      if (!serverAvailable) {
        console.warn(`⚠ Skipping auth-guard probe: ${BASE} not reachable. Start dev server on this port.`)
        return
      }

      // Build probe list: for each route, probe each method.
      //
      // SECURITY MODEL:
      //   The PROBLEM we are guarding against is "200 with PII without
      //   auth" — the A1-A4 P0 holes. A request without a session
      //   should NEVER reach the data-returning code path.
      //
      //   Acceptable responses for an unauthenticated request:
      //     401  — proper auth gate (the goal)
      //     403  — different auth pattern (e.g. system-admin-only routes
      //            that return 403 instead of 401 to avoid leaking
      //            "you're logged in but not admin" — see ldap/servers/[id]/sync)
      //     405  — method not allowed (handler only supports one method;
      //            the method check is a safe early exit before the
      //            data path, so no leak)
      //     429  — rate-limited BEFORE auth (IP throttle) — auth check
      //            happened, but request was rejected first
      //
      //   UNACCEPTABLE responses (test fails):
      //     200/201/204  — data returned without auth (P0 LEAK)
      //     500  — server error AFTER entering data path (could leak
      //            stack traces or partial data)
      //     503  — service unavailable (acceptable for health checks,
      //            UNACCEPTABLE for auth-gated routes — means handler
      //            ran without auth)
      const probes: Array<{ route: string; method: string; expected: number | number[] }> = []
      for (const route of routes) {
        const isPublic = PUBLIC_ROUTES.has(route)
        for (const method of METHODS) {
          if (isPublic) {
            // Public route: 200/201/204 normal; 4xx/5xx OK for edge cases
            // (405 = method not supported; 401/403 = non-session auth
            // patterns like cron bearer secret; 503 = health when DB
            // is down; 500 = server error)
            probes.push({ route, method, expected: [200, 201, 204, 400, 401, 403, 404, 405, 429, 500, 503] })
          } else if (method === 'GET' && PUBLIC_GET_ROUTES.has(route)) {
            // GET on otherwise-protected route is public
            probes.push({ route, method, expected: [200, 400, 404, 500] })
          } else {
            // Protected: must be 401/403/405/429. 200/201/204/500 = FAIL.
            probes.push({ route, method, expected: [401, 403, 405, 429] })
          }
        }
      }

      console.log(`Probing ${probes.length} route × method combinations on ${BASE}...`)

      // Fire probes in batches (dev server cold-compiles routes on first hit;
      // 775 parallel requests = DoS the compiler. Batch in groups of 10.)
      const BATCH_SIZE = 10
      const results: ProbeResult[] = []
      for (let i = 0; i < probes.length; i += BATCH_SIZE) {
        const batch = probes.slice(i, i + BATCH_SIZE)
        const batchResults = await Promise.all(
          batch.map(async (p): Promise<ProbeResult> => {
            try {
              const r = await nodeFetch(`${BASE}${p.route}`, {
                method: p.method,
                signal: AbortSignal.timeout(15000),
              })
              return { ...p, actual: r.status }
            } catch (e) {
              return { ...p, actual: -1, error: String(e) }
            }
          })
        )
        results.push(...batchResults)
      }

      // Collect failures
      const failures = results.filter((r) => {
        if (Array.isArray(r.expected)) {
          return !r.expected.includes(r.actual)
        }
        return r.actual !== r.expected
      })

      if (failures.length > 0) {
        const summary = failures
          .slice(0, 30) // limit output
          .map((f) => `  ${f.method} ${f.route} → ${f.actual} (expected ${Array.isArray(f.expected) ? f.expected.join('/') : f.expected})${f.error ? ' err=' + f.error : ''}`)
          .join('\n')
        const more = failures.length > 30 ? `\n  ... and ${failures.length - 30} more` : ''
        throw new Error(
          `${failures.length} auth-guard failure(s):\n${summary}${more}\n\n` +
          `If a route is intentionally public, add it to PUBLIC_ROUTES or PUBLIC_GET_ROUTES with a justification.`
        )
      }
    },
    120_000 // 2 min — 155 routes × 5 methods = 775 probes (parallel; dev compile is slow)
  )
})
