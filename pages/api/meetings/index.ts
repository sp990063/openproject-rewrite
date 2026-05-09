import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkMeetingConflict } from '@/lib/meeting-conflict'

const createMeetingSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional().default(''),
  authorId: z.string(),
  attendees: z.array(z.string()).optional().default([]),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getMeetings(req, res)
    case 'POST':
      return createMeeting(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getMeetings(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId, startAfter, endBefore } = req.query

    const where: {
      projectId?: string
      startTime?: { gte?: Date; lte?: Date }
    } = {}
    if (projectId) where.projectId = projectId as string
    if (startAfter || endBefore) {
      where.startTime = {}
      if (startAfter) where.startTime.gte = new Date(startAfter as string)
      if (endBefore) where.startTime.lte = new Date(endBefore as string)
    }

    const meetings = await prisma.meeting.findMany({
      where,
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
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return res.status(500).json({ error: 'Failed to fetch meetings' })
  }
}

async function createMeeting(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createMeetingSchema.parse(req.body)

    const startTime = new Date(data.startTime)
    const endTime = new Date(data.endTime)

    if (endTime <= startTime) {
      return res.status(400).json({ error: 'End time must be after start time' })
    }

    // Check for conflicts
    if (data.attendees.length > 0) {
      const conflict = await checkMeetingConflict({
        projectId: data.projectId,
        attendees: data.attendees,
        startTime,
        endTime,
      })
      if (conflict.hasConflict) {
        return res.status(409).json({
          error: 'Scheduling conflict detected',
          conflicts: conflict.conflictingMeetings,
        })
      }
    }

    const meeting = await prisma.meeting.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        startTime,
        endTime,
        location: data.location || null,
        authorId: data.authorId,
        attendees: data.attendees.length > 0 ? {
          create: data.attendees.map((userId) => ({
            userId,
            response: 'none',
          })),
        } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
    })

    return res.status(201).json(meeting)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating meeting:', error)
    return res.status(500).json({ error: 'Failed to create meeting' })
  }
}
