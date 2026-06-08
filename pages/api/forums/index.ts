// pages/api/forums/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 81-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - POST: 403 from project-membership check via assertProjectMembership
//     (was: 201/500 — no RBAC, any logged-in user could create forums
//      on any project, even ones they weren't members of)
//   - 400/404 errors now use uniform error envelope via ApiError
//   - Response shape: GET returns bare array (was: bare array — kept for
//     backward compat with existing hooks), POST wraps in { success, data }
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const createForumSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  authorId: z.string().cuid(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        const { projectId } = query
        if (projectId && typeof projectId === 'string') {
          // If filtering by project, must be a member (or admin) to see its forums.
          await assertProjectMembership(projectId, session.user.id, isAdmin)
        }
        const where: { projectId?: string } = {}
        if (projectId && typeof projectId === 'string') {
          where.projectId = projectId
        }
        const forums = await prisma.forum.findMany({
          where,
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            _count: { select: { threads: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
        return res.status(200).json(forums)
      }

      case 'POST': {
        // Body already validated by withRoute's bodySchema
        // Author must be the session user (don't trust the body's authorId)
        const authorId = session.user.id
        // Project membership required to create a forum in the project
        await assertProjectMembership(body.projectId, authorId, isAdmin)
        const forum = await prisma.forum.create({
          data: {
            projectId: body.projectId,
            name: body.name,
            description: body.description ?? '',
            authorId,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
          },
        })
        return res.status(201).json({ success: true, data: forum })
      }

      default:
        // withRoute's method allow-list already returned 405; this is
        // unreachable but satisfies TypeScript.
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createForumSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
