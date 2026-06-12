/**
 * lib/auth/workPackage.ts
 * =====================================================================
 * Work-package-level permission helpers for use inside `withRoute` HOF
 * route handlers and direct API handlers. Extracted from
 * `pages/api/work-packages/reorder.ts:20-42` (added in commit d5885f8)
 * so multiple routes can share the same RBAC logic.
 *
 * Usage:
 *   // View (any project member)
 *   await assertWorkPackageViewPermission(workPackageId, session.user.id, !!session.user.isSystemAdmin)
 *
 *   // Edit (requires role permission WORK_PACKAGE_EDIT)
 *   await assertWorkPackageEditPermission(workPackageId, session.user.id, !!session.user.isSystemAdmin)
 *
 *   // Delete (requires role permission WORK_PACKAGE_DELETE)
 *   await assertWorkPackageDeletePermission(workPackageId, session.user.id, !!session.user.isSystemAdmin)
 *
 * Both functions throw `ApiError` on denial, which the withRoute HOF
 * formats into a uniform error envelope.
 *
 * --------------------------------------------------------------------------
 * RBAC CONSOLIDATION MIGRATION PLAN (addresses RBAC-2 critical finding)
 * --------------------------------------------------------------------------
 * The codebase currently has three competing RBAC systems:
 *   (1) `lib/auth/project.ts` — `assertXxxProjectMembership` (membership only)
 *   (2) `lib/permissions/check.ts` — `checkProjectPermission` (membership + role permissions + wildcard)
 *   (3) `lib/auth/workPackage.ts` — `assertWorkPackage*Permission` (SCREAMING_CASE permission strings)
 *
 * Phase 7 keeps all three working in parallel for backward compatibility but
 * the long-term plan is:
 *
 *   Step 1 — DONE: All three systems in place; helpers co-exist.
 *   Step 2 — IN PROGRESS: New routes use `assertXxxProjectMembership` + the
 *             `requireProjectPermission` from (2) for fine-grained perms.
 *   Step 3 — TODO: Extend `assertProjectMembership` to accept an optional
 *             `permission?: ProjectPermission` and delegate to (2). Add
 *             mapping table: `WORK_PACKAGE_EDIT` ↔ `work_packages.edit`.
 *   Step 4 — TODO: Deprecate the SCREAMING_CASE path in this file (3) by
 *             renaming `WORK_PACKAGE_EDIT` → `work_packages.edit` in the
 *             role seed and removing the `(3)` API. Migrate the
 *             `work-packages/[id].ts` DELETE branch to use (1)+(2).
 *   Step 5 — TODO: Mark `lib/permissions/check.ts` as the canonical home;
 *             re-export `assertProjectMembership` from
 *             `lib/auth/project.ts` as a thin shim.
 *
 * Out of scope for this sprint — the merge requires a coordinated schema
 * seed update + route sweep + changelog entry. Tracked separately.
 * --------------------------------------------------------------------------
 */

import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/withRoute'

/**
 * Check the user can VIEW a work package (must be a member of its project,
 * or a system admin). Throws ApiError on denial.
 */
export async function assertWorkPackageViewPermission(
  workPackageId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<void> {
  if (isSystemAdmin) return
  if (!workPackageId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Work package ID is required')
  }
  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { projectId: true },
  })
  if (!wp) {
    throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
  }
  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId, projectId: wp.projectId },
    },
    select: { id: true },
  })
  if (!member) {
    throw new ApiError(403, 'FORBIDDEN', 'You must be a project member to access this work package')
  }
}

/**
 * Check the user can EDIT a work package (must have role permission
 * `WORK_PACKAGE_EDIT`, or be a system admin). Throws ApiError on denial.
 */
export async function assertWorkPackageEditPermission(
  workPackageId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<void> {
  if (isSystemAdmin) return
  if (!workPackageId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Work package ID is required')
  }
  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { projectId: true },
  })
  if (!wp) {
    throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
  }
  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId, projectId: wp.projectId },
    },
    include: { role: { select: { permissions: true } } },
  })
  if (!member || !member.role.permissions.includes('WORK_PACKAGE_EDIT')) {
    throw new ApiError(403, 'FORBIDDEN', 'WORK_PACKAGE_EDIT permission required')
  }
}

/**
 * Check the user can DELETE a work package (must have role permission
 * `WORK_PACKAGE_DELETE`, or be a system admin). Throws ApiError on
 * denial.
 *
 * Added per RBAC-1 (Phase 3 Sprint 2 critical finding): this helper was
 * imported by `__tests__/api/work-package-permissions.unit.test.ts` (Phase 7
 * A-sprint) but did not exist in the source. The test file had a full
 * `describe('assertWorkPackageDeletePermission')` block that could not
 * load because the import failed at module init. Mirrors the shape of
 * `assertWorkPackageEditPermission` but checks `WORK_PACKAGE_DELETE`.
 *
 * The `pages/api/work-packages/[id].ts` DELETE handler currently does an
 * inline permission check using the same SCREAMING_CASE constant — the
 * migration plan above (RBAC-2) calls for migrating it to call this
 * helper. Out of scope for this sprint.
 */
export async function assertWorkPackageDeletePermission(
  workPackageId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<void> {
  if (isSystemAdmin) return
  if (!workPackageId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Work package ID is required')
  }
  const wp = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { projectId: true },
  })
  if (!wp) {
    throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
  }
  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId, projectId: wp.projectId },
    },
    include: { role: { select: { permissions: true } } },
  })
  if (!member || !member.role.permissions.includes('WORK_PACKAGE_DELETE')) {
    throw new ApiError(403, 'FORBIDDEN', 'WORK_PACKAGE_DELETE permission required')
  }
}
