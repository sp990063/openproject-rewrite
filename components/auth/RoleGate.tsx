'use client'

// components/auth/RoleGate.tsx
// Conditionally renders children based on the current NextAuth session role.
//
// The decision logic lives in lib/auth/has-role.ts so it can be shared
// with server-side code (getServerSideProps, API routes, RSC, etc.).
import * as React from 'react'
import { useSession } from 'next-auth/react'
import { hasRole, type Role } from '@/lib/auth/has-role'

export interface RoleGateProps {
  /** Required role to render children. */
  role: Role
  /** Content shown when the session matches. */
  children: React.ReactNode
  /**
   * Content shown when the session does NOT match, or while it is still
   * loading (avoids hydration mismatch). Defaults to `null`.
   */
  fallback?: React.ReactNode
}

/**
 * Renders `children` only if the current session satisfies `role`.
 *
 * While `useSession()` reports `status === 'loading'`, the `fallback` is
 * rendered to avoid SSR/CSR mismatches.
 */
export function RoleGate({
  role,
  children,
  fallback = null,
}: RoleGateProps): React.ReactElement {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <>{fallback}</>
  }

  if (!hasRole(session, role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
