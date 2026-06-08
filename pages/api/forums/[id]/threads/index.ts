// pages/api/forums/[id]/threads/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 94-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertForumProjectMembership
//     for GET and POST (was: no RBAC, any logged-in user could read or
//     create threads in any project's forums)
//   - POST: authorId from session (don't trust body's authorId)
//   - Forum ID resolution: accept forumId from query OR fall back to
//     /forums/[id]/threads path param (backward compat with the old
//     /api/forums?forumId=xxx callers and the project-scoped route that
//     delegates here)
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertForumProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const createThreadSchema = z.object({
  forumId: z.string().cuid(),
  subject: z.string().min(1).max(500),
  isSticky: z.boolean().optional().default(false),
  isLocked: z.boolean().optional().default(false),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const isAdmin = !!session.user.isSystemAdmin

    // Resolve forumId: from ?forumId=xxx OR from /forums/[id]/threads path
    let forumId: string | undefined
    if (typeof query.forumId === 'string') {
      forumId = query.forumId
    } else if (typeof query.id === 'string') {
      forumId = query.id
    }
    if (!forumId) {
      throw new ApiError(400, 'BAD_REQUEST', 'forumId is required')
    }

    switch (req.method) {
      case 'GET': {
        await assertForumProjectMembership(forumId, session.user.id, isAdmin)
        const threads = await prisma.forumThread.findMany({
          where: { forumId },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            forum: { select: { id: true, name: true } },
            _count: { select: { posts: true } },
          },
          orderBy: [{ isSticky: 'desc' }, { createdAt: 'desc' }],
        })
        return res.status(200).json(threads)
      }

      case 'POST': {
        // Body already validated; use the schema's forumId (not query)
        // but fall back to query if body didn't include it.
        const targetForumId = body.forumId ?? forumId
        await assertForumProjectMembership(targetForumId, session.user.id, isAdmin)
        const thread = await prisma.forumThread.create({
          data: {
            forumId: targetForumId,
            subject: body.subject,
            authorId: session.user.id, // trusted from session, not body
            isSticky: body.isSticky ?? false,
            isLocked: body.isLocked ?? false,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            forum: { select: { id: true, name: true } },
          },
        })
        return res.status(201).json({ success: true, data: thread })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createThreadSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
