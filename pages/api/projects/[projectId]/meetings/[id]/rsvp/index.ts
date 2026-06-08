// pages/api/projects/[projectId]/meetings/[id]/rsvp/index.ts
// Phase 7 Sprint B-2 (audit follow-up): migrated from direct handler to
// withRoute HOF. (was: 103-line direct handler with inline getServerSession
// + 401, see Phase 7 Sprint A4 3b26d89 for the auth-only fix).
//
// Why this sprint fixes it:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership
//     (was: no RBAC — any logged-in user could RSVP for any meeting,
//     which is a privacy/state-integrity concern: setting
//     accepted/declined on meetings you shouldn't see)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline try/parse +
//     ad-hoc zod-error catch)
//   - Meeting-belongs-to-project invariant preserved
//
// Note: this endpoint is currently unused by the frontend (no fetch URL
// matches `/api/projects/.../meetings/[id]/rsvp` in hooks/ pages/
// components/) — fixing it is defense-in-depth so the next caller
// inherits RBAC + uniform envelope for free.
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { emitActivity } from '@/lib/activity'
import { z } from 'zod'

const rsvpSchema = z.object({
  status: z.enum(['accepted', 'declined', 'tentative']),
  comment: z.string().max(500).optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const projectId = query.projectId as string
    const meetingId = query.id as string
    if (!projectId || !meetingId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID and Meeting ID are required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    await assertProjectMembership(projectId, session.user.id, isAdmin)

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: { where: { userId: session.user.id } } },
    })
    if (!meeting || meeting.projectId !== projectId) {
      throw new ApiError(404, 'MEETING_NOT_FOUND', 'Meeting not found')
    }

    // Map API status → Prisma MeetingAttendee.response enum
    const response =
      body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : 'tentative'

    let attendee
    if (meeting.attendees.length > 0) {
      attendee = await prisma.meetingAttendee.update({
        where: { id: meeting.attendees[0].id },
        data: { response, comment: body.comment ?? null },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      })
    } else {
      attendee = await prisma.meetingAttendee.create({
        data: {
          meetingId,
          userId: session.user.id,
          response,
          comment: body.comment ?? null,
        },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      })
    }

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'meeting' as never,
      subjectId: meetingId,
      action: 'rsvp' as never,
      reference: {
        type: 'meeting' as never,
        id: meetingId,
        subject: meeting.title,
      },
    })

    return res.status(200).json({ attendee })
  },
  {
    methods: ['POST'],
    bodySchema: rsvpSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
