import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const setAttendeesSchema = z.object({
  attendees: z.array(
    z.object({
      userId: z.string().cuid(),
      response: z.enum(['none', 'accepted', 'declined']).optional().default('none'),
      comment: z.string().optional(),
    })
  ),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Meeting ID is required' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const data = setAttendeesSchema.parse(req.body)

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { attendees: true },
    })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const attendeeIds = data.attendees.map((a) => a.userId)

    // Check for conflicts with new attendees (excluding current meeting)
    if (attendeeIds.length > 0) {
      const conflict = await checkMeetingConflict({
        projectId: meeting.projectId,
        attendees: attendeeIds,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        excludeMeetingId: id,
      })
      if (conflict.hasConflict) {
        return res.status(409).json({
          error: 'Scheduling conflict detected',
          conflicts: conflict.conflictingMeetings,
        })
      }
    }

    // Replace all attendees
    await prisma.meetingAttendee.deleteMany({ where: { meetingId: id } })

    await prisma.meetingAttendee.createMany({
      data: data.attendees.map((a) => ({
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error setting attendees:', error)
    return res.status(500).json({ error: 'Failed to set attendees' })
  }
}
