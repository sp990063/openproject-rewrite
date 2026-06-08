// pages/api/projects/[projectId]/forums/[forumId]/threads/[threadId]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 145-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ../../_membership.ts) for GET/PATCH/DELETE
//     (was: inline prisma.member.findUnique)
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - Two emitActivity calls preserved (forum_thread, valid type)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../../_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const UpdateThreadSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  isSticky: z.boolean().optional(),
  isLocked: z.boolean().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
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

    switch (req.method) {
      case 'GET': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        // Verify thread exists and belongs to forum/project
        const existing = await prisma.forumThread.findFirst({
          where: { id: threadId, forumId },
          include: { forum: { select: { projectId: true } } },
        })
        if (!existing) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            forum: { select: { id: true, name: true, projectId: true } },
            posts: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { posts: true } },
          },
        })
        if (!thread) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        void membership // no behavioral change — kept for audit parity
        return res.status(200).json(thread)
      }

      case 'PATCH': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forumThread.findFirst({
          where: { id: threadId, forumId },
          include: { forum: { select: { projectId: true } } },
        })
        if (!existing) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        const thread = await prisma.forumThread.update({
          where: { id: threadId },
          data: {
            ...(body.subject !== undefined && { subject: body.subject }),
            ...(body.isSticky !== undefined && { isSticky: body.isSticky }),
            ...(body.isLocked !== undefined && { isLocked: body.isLocked }),
          },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            forum: { select: { id: true, name: true, projectId: true } },
          },
        })
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_thread',
          subjectId: makeSubjectId('forum_thread', thread.id),
          action: 'updated',
          reference: {
            type: 'forum_thread',
            id: thread.id,
            subject: thread.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(200).json({ success: true, data: thread })
      }

      case 'DELETE': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forumThread.findFirst({
          where: { id: threadId, forumId },
          include: { forum: { select: { projectId: true } } },
        })
        if (!existing) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        await prisma.forumThread.delete({ where: { id: threadId } })
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_thread',
          subjectId: makeSubjectId('forum_thread', existing.id),
          action: 'deleted',
          reference: {
            type: 'forum_thread',
            id: existing.id,
            subject: existing.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(200).json({ success: true })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: UpdateThreadSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
