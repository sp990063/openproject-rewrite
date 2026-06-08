// pages/api/forums/[id]/threads/[threadId]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 115-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertThreadProjectMembership
//     for GET/PATCH/DELETE (was: no RBAC, any logged-in user could read
//     or modify any thread, including its full post history + author
//     emails — competitive intel / PII leak vector)
//   - 404 if thread doesn't exist (was: 500 with console.error)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertThreadProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const updateThreadSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  isSticky: z.boolean().optional(),
  isLocked: z.boolean().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const threadId = query.threadId as string
    if (!threadId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Thread ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            forum: {
              select: { id: true, name: true, project: { select: { id: true, name: true, identifier: true } } },
            },
            posts: {
              include: {
                author: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { posts: true } },
          },
        })
        if (!thread) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        return res.status(200).json(thread)
      }

      case 'PATCH': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        const thread = await prisma.forumThread.update({
          where: { id: threadId },
          data: {
            ...(body.subject !== undefined && { subject: body.subject }),
            ...(body.isSticky !== undefined && { isSticky: body.isSticky }),
            ...(body.isLocked !== undefined && { isLocked: body.isLocked }),
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            forum: { select: { id: true, name: true } },
          },
        })
        return res.status(200).json({ success: true, data: thread })
      }

      case 'DELETE': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        await prisma.forumThread.delete({ where: { id: threadId } })
        return res.status(204).end()
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateThreadSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
