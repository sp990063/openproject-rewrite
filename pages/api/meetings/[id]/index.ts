// pages/api/meetings/[id]/index.ts
// Phase 7 Sprint B-2 (pilot): migrated from direct handler to withRoute HOF
// (was: 148-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertMeetingProjectMembership
//     for GET (was: 200 with data — non-members could read any meeting
//     metadata, including agenda + minutes + attendees w/ PII)
//   - 403 same for PATCH/DELETE (was: no RBAC, any logged-in user could
//     modify/delete meetings in projects they weren't members of)
//   - 404 from assertMeetingProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertMeetingProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { z } from 'zod'

const updateMeetingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().nullable().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const id = query.id as string
    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'Meeting ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
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
        return res.status(200).json(meeting)
      }

      case 'PATCH': {
        const projectId = await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const existing = await prisma.meeting.findUnique({
          where: { id },
          include: { attendees: true },
        })
        if (!existing) {
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
            projectId,
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
        return res.status(200).json(meeting)
      }

      case 'DELETE': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const existing = await prisma.meeting.findUnique({ where: { id } })
        if (!existing) {
          throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
        }
        await prisma.meeting.delete({ where: { id } })
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
