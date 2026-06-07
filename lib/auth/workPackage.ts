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
 * Both functions throw `ApiError` on denial, which the withRoute HOF
 * formats into a uniform error envelope.
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
