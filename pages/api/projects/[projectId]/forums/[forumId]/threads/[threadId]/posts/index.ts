// pages/api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 127-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ../../../_membership.ts) for GET and POST
//     (was: inline prisma.member.findUnique)
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - Thread-locked check preserved (was: inline if, now ApiError 403)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../../../_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const CreatePostSchema = z.object({
  content: z.string().min(1),
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
        await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        // Verify thread exists and belongs to forum
        const thread = await prisma.forumThread.findFirst({
          where: { id: threadId, forumId },
          include: { forum: { select: { projectId: true } } },
        })
        if (!thread) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        const { page = '1', pageSize = '20' } = query
        const pageNum = Math.max(1, Number(page) || 1)
        const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20))
        const skip = (pageNum - 1) * sizeNum
        const [posts, total] = await Promise.all([
          prisma.forumPost.findMany({
            where: { threadId },
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
            skip,
            take: sizeNum,
          }),
          prisma.forumPost.count({ where: { threadId } }),
        ])
        return res.status(200).json({
          posts,
          pagination: {
            page: pageNum,
            pageSize: sizeNum,
            total,
            totalPages: Math.ceil(total / sizeNum),
          },
        })
      }

      case 'POST': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        // Verify thread exists and belongs to forum
        const thread = await prisma.forumThread.findFirst({
          where: { id: threadId, forumId },
          include: { forum: { select: { projectId: true } } },
        })
        if (!thread) {
          throw new ApiError(404, 'THREAD_NOT_FOUND', 'Thread not found')
        }
        // Cannot post to locked threads
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
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_post',
          subjectId: makeSubjectId('forum_post', post.id),
          action: 'created',
          reference: {
            type: 'forum_post',
            id: post.id,
            subject: thread.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(201).json({ success: true, data: { post } })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: CreatePostSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
