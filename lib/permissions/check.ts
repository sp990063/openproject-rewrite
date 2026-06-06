// lib/permissions/check.ts
// Central permission utility for Phase 3.
//
// Per spec §4.2: Role.permissions is a String[] where `'*'` means "all permissions".
// Per spec §4.4: Permission union covers project-level concerns (work packages,
// members, project, wiki, forums, documents, time entries).
//
// This module is the single source of truth for the spec §4.2 wildcard rule.
// It does NOT replace the existing `lib/permissions/work-packages.ts` — that file
// owns WP-specific SCREAMING_CASE permissions (WORK_PACKAGE_VIEW etc.) for the
// existing RBAC path. New project-level code should import from here.

import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/**
 * Project-level permission strings (spec §4.4).
 *
 * Each `permissions: String[]` field on the Role model is one of these values,
 * or `'*'` as a wildcard (admin / super-user shortcut).
 */
export type ProjectPermission =
  | 'work_packages.view'
  | 'work_packages.create'
  | 'work_packages.edit'
  | 'work_packages.delete'
  | 'work_packages.assign'
  | 'members.view'
  | 'members.manage'
  | 'project.view'
  | 'project.edit'
  | 'project.delete'
  | 'wiki.view'
  | 'wiki.edit'
  | 'forums.view'
  | 'forums.create'
  | 'documents.view'
  | 'documents.create'
  | 'time_entries.view'
  | 'time_entries.edit'

/** Wildcard marker — the Admin role in seed may carry this, and any custom
 *  role created by a system admin can opt-in to all permissions via `'*'`. */
export const ALL_PERMISSIONS_WILDCARD = '*'

/**
 * Check whether a role's permission list grants the requested permission.
 *
 * Rule (spec §4.2):
 *   - If `'*'` is in the list → true (always)
 *   - Otherwise → exact string match
 *
 * The function is total over `string[]`: legacy seeded roles that use
 * `manage_project` / `view_work_packages` style names will simply return
 * `false` for a `ProjectPermission` they don't carry. That's the correct
 * behavior — those are Phase 1 permission strings, not Phase 3 spec
 * permission strings. Future migration: extend seed to use both.
 */
export function hasProjectPermission(
  rolePermissions: readonly string[],
  permission: ProjectPermission,
): boolean {
  if (!Array.isArray(rolePermissions)) return false
  if (rolePermissions.includes(ALL_PERMISSIONS_WILDCARD)) return true
  return rolePermissions.includes(permission)
}

/**
 * Server-side: look up the current user's role on a project and check
 * whether it grants the requested permission. System admins always pass.
 *
 * Returns `false` (not throws) on any lookup failure so the caller can use
 * the result as a gate without try/catch.
 */
export async function checkProjectPermission(
  projectId: string,
  permission: ProjectPermission,
  session: Session | null,
): Promise<boolean> {
  if (!session?.user?.id) return false
  if (session.user.isSystemAdmin === true) return true

  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
    include: { role: true },
  })

  if (!member) return false
  return hasProjectPermission(member.role.permissions, permission)
}

/**
 * Require a specific project-level permission for the current user.
 * Returns `null` if permitted, or an error-shape object suitable for
 * `withRoute` HOF's RBAC failure path.
 *
 * 404 if the user is not a member of the project (distinguishes "no
 * membership" from "wrong role" — same response shape, different code).
 */
export async function requireProjectPermission(
  projectId: string,
  permission: ProjectPermission,
  session: Session | null,
): Promise<null | { status: number; code: string }> {
  const ok = await checkProjectPermission(projectId, permission, session)
  if (ok) return null
  if (!session?.user?.id) {
    return { status: 401, code: 'UNAUTHENTICATED' }
  }
  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
    select: { id: true },
  })
  if (!member) {
    return { status: 404, code: 'NOT_A_MEMBER' }
  }
  return { status: 403, code: 'FORBIDDEN' }
}
