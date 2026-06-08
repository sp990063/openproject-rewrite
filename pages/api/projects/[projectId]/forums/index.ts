// pages/api/projects/[projectId]/forums/index.ts
// Phase 7 Sprint B-1: migrated from direct handler to withRoute HOF
// (was: 103-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembershipWithProject
//     (shared helper at ./  _membership.ts) for GET and POST
//     (was: inline prisma.member.findUnique × 2)
//   - Body validation via withRoute's bodySchema (was: inline safeParse)
//   - Uniform error envelope via ApiError
//   - POST: emitActivity preserved with pre-existing 'forum' subject
//     type schema gap (TS2322 pre-existing debt from original file).
//     The makeSubjectId 'forum' literal is preserved verbatim so we
//     don't accidentally fix the schema gap as part of this migration.
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembershipWithProject } from './_membership'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { z } from 'zod'

const CreateForumSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().default(''),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = (query.projectId as string) || (query.id as string)
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertProjectMembershipWithProject(projectId, session.user.id, isAdmin)
        const forums = await prisma.forum.findMany({
          where: { projectId },
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
        const membership = await assertProjectMembershipWithProject(
          projectId,
          session.user.id,
          isAdmin
        )
        const forum = await prisma.forum.create({
          data: {
            projectId,
            name: body.name,
            description: body.description ?? '',
            authorId: session.user.id,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
          },
        })
        // Pre-existing baseline behavior: 'forum' is not a valid
        // ActivitySubjectType. Preserved verbatim so the schema gap
        // stays a known debt, not silently fixed by this migration.
        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'forum', // TS2322 pre-existing
          subjectId: makeSubjectId('forum' as never, forum.id), // TS2345 pre-existing
          action: 'created',
          reference: {
            type: 'forum',
            id: forum.id,
            subject: forum.name,
            projectName: membership.project?.name,
            actorName: session.user.name ?? '',
          },
        })
        return res.status(201).json({ success: true, data: forum })
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: CreateForumSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
