// pages/api/projects/[projectId]/meetings/index.ts
// Phase 7 Sprint B-2 (audit follow-up): migrated from direct handler to
// withRoute HOF. (was: 117-line direct handler with inline getServerSession
// + 401, see Phase 7 Sprint A4 3b26d89 for the auth-only fix).
//
// Why this sprint fixes it (the cross-meeting routes in B-2 Sprint 1
// fixed the same gap; this is the project-scoped half that frontend
// `useMeetings` / `useMeeting` actually hit):
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership
//     for GET and POST (was: 200/201 with data — non-members could
//     enumerate meetings + attendees PII in any project, and create
//     meetings in projects they weren't members of)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - authorId from session.user.id (was: already session-derived —
//     preserved)
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
//   - 409 conflict: uniform {success:false,error:{code,message,details}}
//     envelope (was: ad-hoc {error, conflicts} string shape)
//   - GET response shape: direct array (was: wrapped in {meetings:[]}
//     — a frontend-incompatibility that surfaced as 'meetings is not
//     iterable' in useMeetings on the project-scoped URL; the
//     cross-meeting /api/meetings GET already returned an array)
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { emitActivity } from '@/lib/activity'
import { z } from 'zod'

const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().nullable().optional(),
  attendeeIds: z.array(z.string()).optional().default([]),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = query.projectId as string
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertProjectMembership(projectId, session.user.id, isAdmin)
        const meetings = await prisma.meeting.findMany({
          where: { projectId },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            _count: { select: { agenda: true } },
          },
          orderBy: { startTime: 'asc' },
        })
        return res.status(200).json(meetings)
      }

      case 'POST': {
        await assertProjectMembership(projectId, session.user.id, isAdmin)

        const startTime = new Date(body.startTime)
        const endTime = new Date(body.endTime)

        if (endTime <= startTime) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'End time must be after start time')
        }

        // Check for scheduling conflicts
        if (body.attendeeIds.length > 0) {
          const conflict = await checkMeetingConflict({
            projectId,
            attendees: body.attendeeIds,
            startTime,
            endTime,
          })
          if (conflict.hasConflict) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'CONFLICT',
                message: 'Scheduling conflict detected',
                details: { conflicts: conflict.conflictingMeetings },
              },
            })
          }
        }

        const meeting = await prisma.meeting.create({
          data: {
            projectId,
            title: body.title,
            startTime,
            endTime,
            location: body.location ?? null,
            authorId: session.user.id,
            attendees: body.attendeeIds.length > 0
              ? {
                  create: body.attendeeIds.map((userId) => ({ userId, response: 'none' })),
                }
              : undefined,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
          },
        })

        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'meeting',
          subjectId: meeting.id,
          action: 'created',
          reference: { type: 'meeting', id: meeting.id, subject: meeting.title },
        })

        return res.status(201).json(meeting)
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createMeetingSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
