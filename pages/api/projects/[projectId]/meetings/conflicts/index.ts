// pages/api/projects/[projectId]/meetings/conflicts/index.ts
// Phase 7 Sprint B-2 (audit follow-up): migrated from direct handler to
// withRoute HOF. (was: 79-line direct handler, see Phase 7 Sprint A4
// 3b26d89 for the auth-only fix).
//
// Why this sprint fixes it:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership
//     (was: no RBAC — any logged-in user could probe the conflict
//     endpoint for any project, leaking whether meetings exist and
//     when via the conflictingMeetings payload)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body/query validation: withRoute querySchema (was: inline
//     type-cast `as string` on req.query with no runtime check)
//   - Method allow-list: enforced by withRoute's methods config
//
// Note: this endpoint is currently unused by the frontend (no fetch URL
// matches `/api/projects/.../meetings/conflicts` in hooks/ pages/
// components/) — fixing it is defense-in-depth.
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { z } from 'zod'

const conflictQuerySchema = z.object({
  projectId: z.string().optional(), // present in URL but we re-validate below
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendeeIds: z.string().optional(), // comma-separated user IDs
  excludeMeetingId: z.string().optional(),
})

export default withRoute(
  async ({ req, res, session, query }) => {
    const projectId = query.projectId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    await assertProjectMembership(projectId, session.user.id, isAdmin)

    const attendeeIds = query.attendeeIds
      ? query.attendeeIds.split(',').filter(Boolean)
      : []

    const conflict = await checkMeetingConflict({
      projectId,
      attendees: attendeeIds,
      startTime: new Date(query.startTime),
      endTime: new Date(query.endTime),
      excludeMeetingId: query.excludeMeetingId,
    })

    return res.status(200).json(conflict)
  },
  {
    methods: ['GET'],
    querySchema: conflictQuerySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
