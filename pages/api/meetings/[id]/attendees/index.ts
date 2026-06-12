// pages/api/meetings/[id]/attendees/index.ts
// Phase 7 Sprint B-2: migrated from direct handler to withRoute HOF
// (was: 96-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertMeetingProjectMembership
//     for POST (was: 200 with data — non-members could rewrite the
//     attendee list of any meeting, including injecting PII / user IDs
//     they don't own)
//   - 404 from assertMeetingProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
//   - 409 conflict now uses the uniform {success:false,error:{code,message,
//     details}} envelope (was: ad-hoc {error, conflicts} shape)
// Phase 3 Sprint 7 FM-6 fix: every attendee userId must be a member of
// the meeting's project. Previously any project member could add arbitrary
// non-member user IDs (including service accounts or external users) to
// a meeting's attendee list — a data-leak / HR-spam vector.
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertMeetingProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { z } from 'zod'

const setAttendeesSchema = z.object({
  attendees: z.array(
    z.object({
      userId: z.string().cuid(),
      response: z.enum(['none', 'accepted', 'declined']).optional().default('none'),
      comment: z.string().optional(),
    })
  ),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const id = query.id as string
    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'Meeting ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    // Membership check resolves meeting → project + asserts membership.
    const projectId = await assertMeetingProjectMembership(id, session.user.id, isAdmin)

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { attendees: true },
    })
    if (!meeting) {
      throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
    }

    const attendeeIds = body.attendees.map((a) => a.userId)

    // FM-6: every attendee must be a project member. We dedupe first so
    // the membership query is cheap regardless of how many duplicate
    // userIds the client sent. System admins can bypass (they can do
    // anything else in the project).
    const uniqueAttendeeIds = Array.from(new Set(attendeeIds))
    if (!isAdmin && uniqueAttendeeIds.length > 0) {
      const validMemberships = await prisma.member.findMany({
        where: {
          projectId,
          userId: { in: uniqueAttendeeIds },
        },
        select: { userId: true },
      })
      const validSet = new Set(validMemberships.map((m) => m.userId))
      const invalid = uniqueAttendeeIds.filter((uid) => !validSet.has(uid))
      if (invalid.length > 0) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'All attendees must be members of the project',
          { invalidAttendees: invalid }
        )
      }
    }

    // Check for conflicts with new attendees (excluding current meeting)
    if (attendeeIds.length > 0) {
      const conflict = await checkMeetingConflict({
        projectId,
        attendees: attendeeIds,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
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

    // Replace all attendees
    await prisma.meetingAttendee.deleteMany({ where: { meetingId: id } })
    await prisma.meetingAttendee.createMany({
      data: body.attendees.map((a) => ({
        meetingId: id,
        userId: a.userId,
        response: a.response,
        comment: a.comment ?? null,
      })),
    })

    const updated = await prisma.meeting.findUnique({
      where: { id },
      include: {
        attendees: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    })

    return res.status(200).json(updated?.attendees ?? [])
  },
  {
    methods: ['POST'],
    bodySchema: setAttendeesSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
