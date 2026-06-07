import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const updateMeetingSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().nullable().optional(),
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

  switch (req.method) {
    case 'GET':
      return getMeeting(req, res, id)
    case 'PATCH':
      return updateMeeting(req, res, id)
    case 'DELETE':
      return deleteMeeting(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getMeeting(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
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
      return res.status(404).json({ error: 'Meeting not found' })
    }

    return res.status(200).json(meeting)
  } catch (error) {
    console.error('Error fetching meeting:', error)
    return res.status(500).json({ error: 'Failed to fetch meeting' })
  }
}

async function updateMeeting(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateMeetingSchema.parse(req.body)

    const existing = await prisma.meeting.findUnique({
      where: { id },
      include: { attendees: true },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const startTime = data.startTime ? new Date(data.startTime) : existing.startTime
    const endTime = data.endTime ? new Date(data.endTime) : existing.endTime

    if (endTime <= startTime) {
      return res.status(400).json({ error: 'End time must be after start time' })
    }

    // Check for conflicts if time/attendees changed
    const attendeeIds = existing.attendees.map((a) => a.userId)
    if (data.startTime || data.endTime) {
      const conflict = await checkMeetingConflict({
        projectId: existing.projectId,
        attendees: attendeeIds,
        startTime,
        endTime,
        excludeMeetingId: id,
      })
      if (conflict.hasConflict) {
        return res.status(409).json({
          error: 'Scheduling conflict detected',
          conflicts: conflict.conflictingMeetings,
        })
      }
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
        ...(data.endTime !== undefined && { endTime: new Date(data.endTime) }),
        ...(data.location !== undefined && { location: data.location }),
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating meeting:', error)
    return res.status(500).json({ error: 'Failed to update meeting' })
  }
}

async function deleteMeeting(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id } })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    await prisma.meeting.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return res.status(500).json({ error: 'Failed to delete meeting' })
  }
}
