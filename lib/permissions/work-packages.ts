import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import type { SessionStrategy } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type Permission = 'WORK_PACKAGE_VIEW' | 'WORK_PACKAGE_EDIT' | 'WORK_PACKAGE_DELETE' | 'WORK_PACKAGE_CREATE'

/** Type-cast authOptions to satisfy getServerSession's strict session.strategy typing */
const getSession = () => getServerSession(authOptions as { session: { strategy: SessionStrategy }; providers: typeof authOptions.providers; adapter: typeof authOptions.adapter; pages: typeof authOptions.pages; callbacks: typeof authOptions.callbacks })

/**
 * Check if the current user has a specific permission on a work package's project.
 * Requires active session.
 */
export async function checkWorkPackagePermission(
  workPackageId: string,
  permission: Permission
): Promise<boolean> {
  const session = await getSession()
  if (!session?.user?.id) {
    return false
  }

  // System admins have all permissions
  if (session.user.isSystemAdmin) {
    return true
  }

  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { projectId: true },
  })

  if (!workPackage) {
    return false
  }

  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: workPackage.projectId,
      },
    },
    include: { role: true },
  })

  if (!member) {
    return false
  }

  return member.role.permissions.includes(permission)
}

/**
 * Require a specific permission on a work package, returning error response helper.
 * Returns null if permitted, or an error object { status, code } if not.
 */
export async function requireWorkPackagePermission(
  workPackageId: string,
  permission: Permission
): Promise<null | { status: number; code: string }> {
  const hasPermission = await checkWorkPackagePermission(workPackageId, permission)
  if (!hasPermission) {
    // Distinguish 404 (WP not found) vs 403 (no permission)
    const wp = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      select: { id: true },
    })
    if (!wp) {
      return { status: 404, code: 'WORK_PACKAGE_NOT_FOUND' }
    }
    return { status: 403, code: 'FORBIDDEN' }
  }
  return null
}
