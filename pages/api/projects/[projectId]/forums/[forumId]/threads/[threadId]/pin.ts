// pages/api/projects/[projectId]/forums/[forumId]/threads/[threadId]/pin.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 65-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from admin-only check via session.user.isSystemAdmin
//     (was: extra DB roundtrip via isSystemAdmin() helper)
//   - Project-membership check now uses assertProjectMembershipWithProject
//     (shared helper at ../../../_membership.ts) — though admin-only
//     gate means it never rejects in practice, kept for defense in depth
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../../_membership'

export default withRoute(
  async ({ req, res, session, query }) => {
    const projectId = query.projectId as string
    const forumId = query.forumId as string
    const threadId = query.threadId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    if (!forumId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
    }
    if (!threadId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Thread ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    if (req.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }

    // Project-membership check (defense in depth — admin gate below is the real auth)
    await assertProjectMembershipWithProject(projectId, session.user.id, isAdmin)

    // Admin only for pin/unpin
    if (!isAdmin) {
      throw new ApiError(403, 'ADMIN_ONLY', 'Only admins can pin/unpin threads')
    }

    // Verify thread exists and belongs to forum
    const existing = await prisma.forumThread.findFirst({
      where: { id: threadId, forumId },
    })
    if (!existing) {
      throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
    }

    // Toggle pin status
    const thread = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned: !existing.isPinned },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        forum: { select: { id: true, name: true, projectId: true } },
      },
    })
    return res.status(200).json({ thread, isPinned: thread.isPinned })
  },
  {
    methods: ['POST'],
  }
)
