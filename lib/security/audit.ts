// lib/security/audit.ts
// Phase 0: minimal security event recorder. Persists to Sentry (when configured)
// and to a rolling in-memory ring buffer (last 500 events) for fast debugging.
// Phase 1 will replace this with a proper `AuditLog` Prisma model.
import * as Sentry from '@sentry/nextjs'

export type SecurityEventType =
  | 'LDAP_AUTH_USER_NOT_FOUND'
  | 'LDAP_AUTH_AMBIGUOUS_MATCH'
  | 'LDAP_AUTH_INVALID_DN'
  | 'WEBAUTHN_CHALLENGE_ISSUED'
  | 'WEBAUTHN_CHALLENGE_MISS'
  | 'WEBAUTHN_CHALLENGE_MISMATCH'
  | 'WEBAUTHN_REGISTRATION_FAILED'
  | 'WEBAUTHN_AUTH_FAILED'
  | 'WEBAUTHN_AUTH_SUCCESS'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_REJECTED'
  | 'CORS_REJECTED'

export interface SecurityEvent {
  type: SecurityEventType
  /** Best-effort client IP (X-Forwarded-For aware, set by caller). */
  ip: string | null
  /** Acting user id, if known. */
  userId: string | null
  /** Free-form metadata. Never include raw passwords, tokens, or full DNs. */
  meta?: Record<string, unknown>
  /** ISO-8601 timestamp. */
  at?: string
}

const RING_SIZE = 500
const ring: SecurityEvent[] = []

function pushRing(ev: SecurityEvent): void {
  ring.push(ev)
  if (ring.length > RING_SIZE) ring.shift()
}

/** Test / debug helper — never call from prod code paths. */
export function getRecentSecurityEvents(limit = 50): SecurityEvent[] {
  return ring.slice(-limit)
}

export async function recordSecurityEvent(ev: SecurityEvent): Promise<void> {
  const enriched: SecurityEvent = { at: new Date().toISOString(), ...ev }
  pushRing(enriched)

  // Sentry breadcrumb in prod; warning in dev. Failures here must not break
  // the calling code path.
  try {
    Sentry.addBreadcrumb({
      category: 'security',
      level: 'warning',
      message: enriched.type,
      data: { ip: enriched.ip, userId: enriched.userId, ...(enriched.meta ?? {}) },
    })
  } catch {
    // Sentry not initialized or unavailable — silent.
  }

  // Mirror to stdout so on-call can `grep` the dev/staging logs.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[security] ${enriched.type} ip=${enriched.ip ?? '-'} uid=${enriched.userId ?? '-'}`, enriched.meta ?? {})
  }
}
