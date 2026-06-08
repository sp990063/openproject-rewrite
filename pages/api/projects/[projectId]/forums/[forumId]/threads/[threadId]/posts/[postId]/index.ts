// pages/api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/[postId]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 137-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ../../../../_membership.ts) for GET/PATCH/DELETE
//     (was: inline prisma.member.findUnique)
//   - Author-or-admin ownership check on PATCH/DELETE preserved
//     (now uses session.user.isSystemAdmin from the session token
//     instead of an extra DB roundtrip via isSystemAdmin())
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - Two emitActivity calls preserved (forum_post, valid type)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../../../../_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const UpdatePostSchema = z.object({
  content: z.string().min(1),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = query.projectId as string
    const forumId = query.forumId as string
    const threadId = query.threadId as string
    const postId = query.postId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    if (!forumId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
    }
    if (!threadId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Thread ID is required')
    }
    if (!postId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Post ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forumPost.findFirst({
          where: { id: postId, threadId },
          include: {
            thread: { select: { subject: true, forum: { select: { projectId: true } } } },
          },
        })
        if (!existing) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        return res.status(200).json(existing)
      }

      case 'PATCH': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forumPost.findFirst({
          where: { id: postId, threadId },
          include: {
            thread: { select: { subject: true, forum: { select: { projectId: true } } } },
          },
        })
        if (!existing) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        // Only author or admin can update
        if (existing.authorId !== session.user.id && !isAdmin) {
          throw new ApiError(
            403,
            'FORBIDDEN',
            'Only the author or an admin can update this post'
          )
        }
        const post = await prisma.forumPost.update({
          where: { id: postId },
          data: { content: body.content },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_post',
          subjectId: makeSubjectId('forum_post', post.id),
          action: 'updated',
          reference: {
            type: 'forum_post',
            id: post.id,
            subject: existing.thread.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(200).json({ success: true, data: post })
      }

      case 'DELETE': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forumPost.findFirst({
          where: { id: postId, threadId },
          include: {
            thread: { select: { subject: true, forum: { select: { projectId: true } } } },
          },
        })
        if (!existing) {
          throw new ApiError(404, 'POST_NOT_FOUND', 'Post not found')
        }
        // Only author or admin can delete
        if (existing.authorId !== session.user.id && !isAdmin) {
          throw new ApiError(
            403,
            'FORBIDDEN',
            'Only the author or an admin can delete this post'
          )
        }
        await prisma.forumPost.delete({ where: { id: postId } })
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_post',
          subjectId: makeSubjectId('forum_post', existing.id),
          action: 'deleted',
          reference: {
            type: 'forum_post',
            id: existing.id,
            subject: existing.thread.subject,
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
    bodySchema: UpdatePostSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
