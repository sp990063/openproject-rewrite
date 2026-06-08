// pages/api/projects/[projectId]/meetings/upcoming/index.ts
// Phase 7 Sprint B-2 (audit follow-up): migrated from direct handler to
// withRoute HOF. (was: direct handler with inline getServerSession +
// 401, see Phase 7 Sprint A4 3b26d89 for the auth-only fix).
//
// Why this sprint fixes it:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership
//     (was: no RBAC — any logged-in user could enumerate upcoming
//     meetings + attendees PII in any project)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Method allow-list: enforced by withRoute's methods config
//   - Response shape: direct array (consistent with the list endpoint
//     after Sprint B-2 fix)
//
// Note: this endpoint is currently unused by the frontend (no fetch URL
// matches `/api/projects/.../meetings/upcoming` in hooks/ pages/
// components/) — fixing it is defense-in-depth.
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

// Note: req.query is cast because Next.js Pages Router types the
// path-params loosely — projectId comes from the URL but the HOF's
// default QueryParams type is {string|string[]|undefined} which TS
// would otherwise complain about for our typed access.
const upcomingQuerySchema = z.object({
  projectId: z.string(),
  limit: z.string().regex(/^\d+$/).optional(),
})

export default withRoute(
  async ({ req, res, session, query }) => {
    const projectId = query.projectId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    await assertProjectMembership(projectId, session.user.id, isAdmin)

    const limit = query.limit ? Math.min(100, parseInt(query.limit, 10)) : 10
    const now = new Date()

    const meetings = await prisma.meeting.findMany({
      where: {
        projectId,
        startTime: { gte: now },
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        _count: { select: { agenda: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    })

    return res.status(200).json(meetings)
  },
  {
    methods: ['GET'],
    querySchema: upcomingQuerySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
