// pages/api/projects/[projectId]/forums/_membership.ts
// Local helper shared by the project-scoped forum routes that need
// both project membership check AND the project's name (for activity
// references). Kept local to the forum domain — promote to
// lib/auth/project.ts if a non-forum route needs the same pattern.
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/withRoute'

export async function assertProjectMembershipWithProject(
  projectId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<{ id: string; project: { name: string } | null }> {
  if (isSystemAdmin) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    })
    return { id: projectId, project }
  }
  if (!projectId) {
    throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
  }
  const membership = await prisma.member.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: { select: { name: true } } },
  })
  if (!membership) {
    throw new ApiError(403, 'FORBIDDEN', 'You must be a project member to access this resource')
  }
  return membership
}
