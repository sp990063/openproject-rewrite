// pages/api/forums/[id]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 112-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertForumProjectMembership
//     for GET (was: 200 with data — non-members could read forum metadata)
//   - 403 same for PATCH/DELETE (was: no RBAC, any logged-in user could
//     modify/delete forums in projects they weren't members of)
//   - Uniform error envelope via ApiError for all errors
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertForumProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const updateForumSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const id = query.id as string
    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'Forum ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertForumProjectMembership(id, session.user.id, isAdmin)
        const forum = await prisma.forum.findUnique({
          where: { id },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            threads: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { posts: true } },
              },
              orderBy: [{ isSticky: 'desc' }, { createdAt: 'desc' }],
            },
            _count: { select: { threads: true } },
          },
        })
        if (!forum) {
          throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
        }
        return res.status(200).json(forum)
      }

      case 'PATCH': {
        await assertForumProjectMembership(id, session.user.id, isAdmin)
        const forum = await prisma.forum.update({
          where: { id },
          data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
          },
        })
        return res.status(200).json({ success: true, data: forum })
      }

      case 'DELETE': {
        await assertForumProjectMembership(id, session.user.id, isAdmin)
        await prisma.forum.delete({ where: { id } })
        return res.status(204).end()
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateForumSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
