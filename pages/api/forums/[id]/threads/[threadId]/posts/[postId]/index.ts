// pages/api/forums/[id]/threads/[threadId]/posts/[postId]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 102-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertPostProjectMembership
//     for GET/PATCH/DELETE (was: no RBAC, any logged-in user could read
//     or modify any post including author emails — PII leak vector)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertPostProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const updatePostSchema = z.object({
  content: z.string().min(1),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const postId = query.postId as string
    if (!postId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Post ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertPostProjectMembership(postId, session.user.id, isAdmin)
        // Phase 3 Sprint 7 FM-2 follow-up: don't leak author.email in the
        // post GET response.
        const post = await prisma.forumPost.findUnique({
          where: { id: postId },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            thread: {
              select: { id: true, subject: true, forum: { select: { id: true, name: true } } },
            },
          },
        })
        if (!post) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        return res.status(200).json(post)
      }

      case 'PATCH': {
        await assertPostProjectMembership(postId, session.user.id, isAdmin)
        // Phase 3 Sprint 7 FM-3 fix: only the post author or a system
        // admin can edit a post. Previously any project member could
        // rewrite anyone's post (e.g. griefing via content edits).
        const existingPost = await prisma.forumPost.findUnique({
          where: { id: postId },
          select: { authorId: true },
        })
        if (!existingPost) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        if (!isAdmin && existingPost.authorId !== session.user.id) {
          throw new ApiError(403, 'FORBIDDEN', 'Only the post author or a system admin can edit this post')
        }
        const post = await prisma.forumPost.update({
          where: { id: postId },
          data: { content: body.content },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            thread: { select: { id: true, subject: true } },
          },
        })
        return res.status(200).json({ success: true, data: post })
      }

      case 'DELETE': {
        await assertPostProjectMembership(postId, session.user.id, isAdmin)
        // FM-35 parity: project-scoped DELETE is author-or-admin; do
        // the same here so the two routes behave identically.
        const existingPost = await prisma.forumPost.findUnique({
          where: { id: postId },
          select: { authorId: true },
        })
        if (!existingPost) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        if (!isAdmin && existingPost.authorId !== session.user.id) {
          throw new ApiError(403, 'FORBIDDEN', 'Only the post author or a system admin can delete this post')
        }
        await prisma.forumPost.delete({ where: { id: postId } })
        return res.status(204).end()
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updatePostSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
