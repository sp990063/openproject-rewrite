// pages/api/projects/[projectId]/meetings/[id]/index.ts
// Phase 7 Sprint B-2 (audit follow-up): migrated from direct handler to
// withRoute HOF. (was: 209-line direct handler with inline getServerSession
// + 401 + 3 redundant getServerSession calls inside updateMeeting/deleteMeeting,
// see Phase 7 Sprint A4 3b26d89 for the auth-only fix).
//
// Why this sprint fixes it:
//   - 401 from withRoute's HOF (was: inline getServerSession, redundantly
//     re-called in updateMeeting and deleteMeeting)
//   - 403 from project-membership check via assertProjectMembership for
//     GET/PATCH/DELETE (was: 200/200/204 with data — non-members could
//     read meeting metadata + agenda + minutes + attendees PII, and
//     modify/delete meetings in projects they weren't members of)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline .parse + try/catch)
//   - Method allow-list: enforced by withRoute's methods config
//   - 409 conflict: uniform envelope
//   - Meeting-belongs-to-project invariant preserved: the route
//     verifies meeting.projectId === projectId (defense in depth even
//     though assertProjectMembership already gates on the project)
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { emitActivity } from '@/lib/activity'
import { z } from 'zod'

const updateMeetingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().nullable().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = query.projectId as string
    const id = query.id as string
    if (!projectId || !id) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID and Meeting ID are required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertProjectMembership(projectId, session.user.id, isAdmin)
        const meeting = await prisma.meeting.findUnique({
          where: { id },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            agenda: { orderBy: { position: 'asc' } },
            minutes: {
              include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
          },
        })
        if (!meeting) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        // Defense in depth: assertProjectMembership gates on the
        // projectId in the URL; this guards against a meeting record
        // somehow belonging to a different project than the URL says.
        if (meeting.projectId !== projectId) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        return res.status(200).json(meeting)
      }

      case 'PATCH': {
        await assertProjectMembership(projectId, session.user.id, isAdmin)
        const existing = await prisma.meeting.findUnique({
          where: { id },
          include: { attendees: true },
        })
        if (!existing) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        if (existing.projectId !== projectId) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }

        const startTime = body.startTime ? new Date(body.startTime) : existing.startTime
        const endTime = body.endTime ? new Date(body.endTime) : existing.endTime

        if (endTime <= startTime) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'End time must be after start time')
        }

        // Check for conflicts if time/attendees changed
        const attendeeIds = existing.attendees.map((a) => a.userId)
        if (body.startTime || body.endTime) {
          const conflict = await checkMeetingConflict({
            projectId: existing.projectId,
            attendees: attendeeIds,
            startTime,
            endTime,
            excludeMeetingId: id,
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

        const meeting = await prisma.meeting.update({
          where: { id },
          data: {
            ...(body.title !== undefined && { title: body.title }),
            ...(body.startTime !== undefined && { startTime: new Date(body.startTime) }),
            ...(body.endTime !== undefined && { endTime: new Date(body.endTime) }),
            ...(body.location !== undefined && { location: body.location }),
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            agenda: { orderBy: { position: 'asc' } },
          },
        })

        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'meeting',
          subjectId: meeting.id,
          action: 'updated',
          reference: { type: 'meeting', id: meeting.id, subject: meeting.title },
        })

        return res.status(200).json(meeting)
      }

      case 'DELETE': {
        await assertProjectMembership(projectId, session.user.id, isAdmin)
        const existing = await prisma.meeting.findUnique({ where: { id } })
        if (!existing) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        if (existing.projectId !== projectId) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        await prisma.meeting.delete({ where: { id } })

        await emitActivity({
          projectId,
          userId: session.user.id,
          subjectType: 'meeting',
          subjectId: id,
          action: 'deleted',
          reference: { type: 'meeting', id, subject: existing.title },
        })

        return res.status(204).end()
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateMeetingSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
