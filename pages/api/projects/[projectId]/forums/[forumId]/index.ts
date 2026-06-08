// pages/api/projects/[projectId]/forums/[forumId]/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 159-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership
//     (was: inline prisma.member.findUnique, identical logic)
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - DELETE: 409 if forum has threads preserved (was: 409 bare status)
//   - Uniform error envelope via ApiError
//   - Two emitActivity calls preserve the pre-existing 'forum' subject
//     type schema gap verbatim (TS2322/TS2345 pre-existing debt).
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from '../_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const UpdateForumSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
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
        const forum = await prisma.forum.findFirst({
          where: { id: forumId, projectId },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            threads: {
              include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { posts: true } },
              },
              orderBy: [{ isSticky: 'desc' }, { updatedAt: 'desc' }],
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
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forum.findFirst({
          where: { id: forumId, projectId },
        })
        if (!existing) {
          throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
        }
        const forum = await prisma.forum.update({
          where: { id: forumId },
          data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
          },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        })
        // Pre-existing baseline behavior — 'forum' is not a valid
        // ActivitySubjectType (TS2322 + TS2345 pre-existing debt)
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum', // TS2322 pre-existing
          subjectId: makeSubjectId('forum' as never, forum.id), // TS2345 pre-existing
          action: 'updated',
          reference: {
            type: 'forum',
            id: forum.id,
            subject: forum.name,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(200).json({ success: true, data: forum })
      }

      case 'DELETE': {
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const existing = await prisma.forum.findFirst({
          where: { id: forumId, projectId },
          include: { _count: { select: { threads: true } } },
        })
        if (!existing) {
          throw new ApiError(404, 'FORUM_NOT_FOUND', 'Forum not found')
        }
        // Prevent deletion if forum has threads (cascade would delete them)
        if (existing._count.threads > 0) {
          throw new ApiError(
            409,
            'FORUM_HAS_THREADS',
            'Cannot delete a forum that contains threads'
          )
        }
        await prisma.forum.delete({ where: { id: forumId } })
        // Pre-existing baseline behavior — 'forum' is not a valid
        // ActivitySubjectType (TS2322 + TS2345 pre-existing debt)
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum', // TS2322 pre-existing
          subjectId: makeSubjectId('forum' as never, existing.id), // TS2345 pre-existing
          action: 'deleted',
          reference: {
            type: 'forum',
            id: existing.id,
            subject: existing.name,
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
    bodySchema: UpdateForumSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
