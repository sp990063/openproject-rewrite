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
        // Phase 3 Sprint 7 FM-2 follow-up: don't leak author.email in the
        // post list response.
        const posts = await prisma.forumPost.findMany({
          where: { threadId },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            thread: { select: { id: true, subject: true } },
          },
          orderBy: { createdAt: 'asc' },
        })
        return res.status(200).json(posts)
      }

      case 'POST': {
        await assertThreadProjectMembership(threadId, session.user.id, isAdmin)
        // Phase 3 Sprint 7 FM-9 fix: lock check + post create must be
        // atomic. Previously the handler read thread.isLocked and then
        // issued a separate prisma.forumPost.create — a concurrent lock
        // between those two operations could let a post land in a
        // freshly-locked thread. We do the lock check inside the same
        // transaction that creates the post; if the row is locked the
        // query returns isLocked=true and we abort.
        const post = await prisma.$transaction(async (tx) => {
          const thread = await tx.forumThread.findUnique({
            where: { id: threadId },
            select: { isLocked: true },
          })
          if (!thread) {
            throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
          }
          if (thread.isLocked) {
            throw new ApiError(403, 'THREAD_LOCKED', 'Cannot post to a locked thread')
          }
          return tx.forumPost.create({
            data: {
              threadId,
              content: body.content,
              authorId: session.user.id, // trusted from session, not body
            },
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              thread: { select: { id: true, subject: true } },
            },
          })
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
