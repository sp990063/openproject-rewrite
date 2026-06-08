// pages/api/forums/[id]/threads/[threadId]/posts/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 92-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertThreadProjectMembership
//     for GET and POST (was: no RBAC, any logged-in user could read
//     forum posts with PII or post to locked threads — wait, the
//     thread.isLocked check WAS in the original. Kept it, just now
//     checked AFTER membership.)
//   - POST: authorId from session (don't trust body's authorId)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertThreadProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const createPostSchema = z.object({
  threadId: z.string().cuid().optional(), // may come from query param
  content: z.string().min(1),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const threadId = (query.threadId as string) || body.threadId
    if (!threadId) {
      throw new ApiError(400, 'BAD_REQUEST', 'threadId is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        const posts = await prisma.forumPost.findMany({
          where: { threadId },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            thread: { select: { id: true, subject: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
        return res.status(200).json(posts)
      }

      case 'POST': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        // Check thread lock status
        const thread = await prisma.forumThread.findUnique({
          where: { id: threadId },
          select: { isLocked: true },
        })
        if (!thread) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        if (thread.isLocked) {
          throw new ApiError(403, 'THREAD_LOCKED', 'Cannot post to a locked thread')
        }
        const post = await prisma.forumPost.create({
          data: {
            threadId,
            content: body.content,
            authorId: session.user.id, // trusted from session, not body
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            thread: { select: { id: true, subject: true } },
          },
        })
        return res.status(201).json({ success: true, data: post })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createPostSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
