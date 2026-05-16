
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity } from '@/lib/activity'

const createMeetingSchema = z.object({
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().nullable().optional(),
  attendeeIds: z.array(z.string()).optional().default([]),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }

  // GET /api/projects/[projectId]/meetings — list meetings
  if (req.method === 'GET') {
    const meetings = await prisma.meeting.findMany({
      where: { projectId },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
      },
      orderBy: { startTime: 'asc' },
    })
    return res.json({ meetings })
  }

  // POST /api/projects/[projectId]/meetings — create meeting
  if (req.method === 'POST') {
    const parsed = createMeetingSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const { title, startTime, endTime, location, attendeeIds } = parsed.data

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' })
    }

    // Check for scheduling conflicts
    const { checkMeetingConflict } = await import('@/lib/meeting-conflict')
    if (attendeeIds && attendeeIds.length > 0) {
      const conflict = await checkMeetingConflict({
        projectId,
        attendees: attendeeIds,
        startTime: start,
        endTime: end,
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
        projectId,
        title,
        startTime: start,
        endTime: end,
        location: location ?? null,
        authorId: session.user.id,
        attendees: attendeeIds
          ? {
              create: attendeeIds.map((userId) => ({ userId })),
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

    return res.status(201).json({ meeting })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
