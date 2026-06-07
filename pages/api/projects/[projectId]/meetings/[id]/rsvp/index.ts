/**
 * POST /api/projects/[projectId]/meetings/[id]/rsvp
 *
 * Set the current user's RSVP for a meeting.
 * Body: { status: 'accepted' | 'declined' | 'tentative', comment?: string }
 *
 * Sprint 4 (Meetings) — adds RSVP endpoint not in pre-existing API.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity } from '@/lib/activity'

const rsvpSchema = z.object({
  status: z.enum(['accepted', 'declined', 'tentative']),
  comment: z.string().max(500).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { query } = req
  const projectId = query.projectId as string
  const meetingId = query.id as string

  if (!projectId || !meetingId) {
    return res.status(400).json({ error: 'Project ID and Meeting ID are required' })
  }

  let body
  try {
    body = rsvpSchema.parse(req.body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
    throw err
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { attendees: { where: { userId: session.user.id } } },
    })
    if (!meeting || meeting.projectId !== projectId) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    // Map API status → Prisma MeetingAttendee.response enum
    const response =
      body.status === 'accepted' ? 'accepted' : body.status === 'declined' ? 'declined' : 'tentative'

    let attendee
    if (meeting.attendees.length > 0) {
      // Update existing attendee row
      attendee = await prisma.meetingAttendee.update({
        where: { id: meeting.attendees[0].id },
        data: { response, comment: body.comment ?? null },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      })
    } else {
      // Create attendee row
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
      subjectType: 'meeting',
      subjectId: meetingId,
      action: 'rsvp',
      reference: {
        type: 'meeting',
        id: meetingId,
        subject: meeting.title,
        response,
      },
    })

    return res.status(200).json({ attendee })
  } catch (error) {
    console.error('Error setting RSVP:', error)
    return res.status(500).json({ error: 'Failed to set RSVP' })
  }
}
