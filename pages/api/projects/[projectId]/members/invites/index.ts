// pages/api/projects/[projectId]/members/invites/index.ts
//
// Spec §3.5.3: list pending (unaccepted, unexpired) invites for a
// project. Requires `members.manage` (or system admin).
//
// Response:
//   200 { success: true, data: Invite[] }
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { checkProjectPermission } from '@/lib/permissions/check'

export default withRoute<unknown, unknown, { projectId: string }>(
  async ({ res, session, params }) => {
    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    const ok = await checkProjectPermission(projectId, 'members.manage', session)
    if (!ok) {
      if (!session?.user?.id) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
      const member = await prisma.member.findUnique({
        where: { userId_projectId: { userId: session.user.id, projectId } },
        select: { id: true },
      })
      throw new ApiError(member ? 403 : 404, member ? 'FORBIDDEN' : 'NOT_A_MEMBER', 'Insufficient permission')
    }

    const invites = await prisma.invite.findMany({
      where: {
        projectId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json({ success: true, data: invites })
  },
  {
    methods: ['GET'],
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
