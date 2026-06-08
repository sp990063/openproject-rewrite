// pages/api/projects/[projectId]/forums/[forumId]/threads/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 175-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ../_membership.ts) for GET and POST
//     (was: inline prisma.member.findUnique)
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - Thread + first post creation kept in a single transaction
//   - Two emitActivity calls preserved (forum_thread + forum_post, both
//     valid ActivitySubjectTypes — no pre-existing schema gap here)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../../_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const CreateThreadSchema = z.object({
  subject: z.string().min(1).max(500),
  isSticky: z.boolean().optional().default(false),
  isLocked: z.boolean().optional().default(false),
  // First post content (required at creation)
  content: z.string().min(1),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = query.projectId as string
    const forumId = query.forumId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    if (!forumId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        // Verify forum exists and belongs to project
        const forum = await prisma.forum.findFirst({
          where: { id: forumId, projectId },
        })
        if (!forum) {
          throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
        }
        const { page = '1', pageSize = '20', sticky } = query
        const pageNum = Math.max(1, Number(page) || 1)
        const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20))
        const skip = (pageNum - 1) * sizeNum
        const where: Record<string, unknown> = { forumId }
        if (sticky === 'true') where.isSticky = true
        const [threads, total] = await Promise.all([
          prisma.forumThread.findMany({
            where,
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              _count: { select: { posts: true } },
            },
            orderBy: [
              { isPinned: 'desc' },
              { isSticky: 'desc' },
              { createdAt: 'desc' },
            ],
            skip,
            take: sizeNum,
          }),
          prisma.forumThread.count({ where }),
        ])
        // Reference membership to keep it warm in the audit trail
        // (no behavioral change vs original — membership was used
        //  implicitly in the inline prisma.member.findUnique)
        void membership
        return res.status(200).json({
          threads,
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
        // Verify forum exists and belongs to project
        const forum = await prisma.forum.findFirst({
          where: { id: forumId, projectId },
        })
        if (!forum) {
          throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
        }
        // Create thread and first post in a transaction
        const result = await prisma.$transaction(async (tx) => {
          const thread = await tx.forumThread.create({
            data: {
              forumId,
              subject: body.subject,
              authorId: session.user.id,
              isSticky: body.isSticky ?? false,
              isLocked: body.isLocked ?? false,
            },
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              forum: { select: { id: true, name: true, projectId: true } },
            },
          })
          const post = await tx.forumPost.create({
            data: {
              threadId: thread.id,
              content: body.content,
              authorId: session.user.id,
            },
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
          })
          return { thread, post }
        })
        // Emit activity for thread creation
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_thread',
          subjectId: makeSubjectId('forum_thread', result.thread.id),
          action: 'created',
          reference: {
            type: 'forum_thread',
            id: result.thread.id,
            subject: result.thread.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        // Emit activity for first post creation
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum_post',
          subjectId: makeSubjectId('forum_post', result.post.id),
          action: 'created',
          reference: {
            type: 'forum_post',
            id: result.post.id,
            subject: result.thread.subject,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(201).json({ thread: result.thread, post: result.post })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: CreateThreadSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
