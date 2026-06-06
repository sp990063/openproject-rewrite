// lib/auth/has-role.ts
// Server-safe role check helper that mirrors the RoleGate component logic
// so it can be reused from getServerSideProps, API routes, RSC, etc.
//
// No `'use client'` directive here — keep this file pure for server use.
import type { Session } from 'next-auth'

export type Role = 'admin' | 'system-admin' | 'member'

/**
 * Returns true when the given NextAuth session satisfies the requested role.
 *
 * - `'admin'` and `'system-admin'`: requires `session.user.isSystemAdmin === true`
 *   (this codebase currently collapses both to the same system-admin flag).
 * - `'member'`: requires any signed-in user (presence of `session.user.id`).
 *
 * A null/undefined session always returns false.
 */
export function hasRole(
  session: Session | null | undefined,
  role: Role,
): boolean {
  if (!session?.user) return false

  switch (role) {
    case 'admin':
    case 'system-admin':
      return session.user.isSystemAdmin === true
    case 'member':
      return Boolean(session.user.id)
    default: {
      // Exhaustiveness check — if a new role is added to the union and not
      // handled above, TypeScript will flag this line.
      const _exhaustive: never = role
      return _exhaustive
    }
  }
}
