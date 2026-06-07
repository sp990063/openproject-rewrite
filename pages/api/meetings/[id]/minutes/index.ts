import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const createMinutesSchema = z.object({
  content: z.string().min(1),
  authorId: z.string().cuid(),
})

const updateMinutesSchema = z.object({
  content: z.string().min(1),
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
      return getMinutes(req, res, id)
    case 'POST':
      return createMinutes(req, res, id)
    case 'PATCH':
      return updateMinutes(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getMinutes(req: NextApiRequest, res: NextApiResponse, meetingId: string) {
  try {
    const minutes = await prisma.meetingMinutes.findUnique({
      where: { meetingId },
      include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    if (!minutes) {
      return res.status(404).json({ error: 'Minutes not found' })
    }

    return res.status(200).json(minutes)
  } catch (error) {
    console.error('Error fetching minutes:', error)
    return res.status(500).json({ error: 'Failed to fetch minutes' })
  }
}

async function createMinutes(req: NextApiRequest, res: NextApiResponse, meetingId: string) {
  try {
    const data = createMinutesSchema.parse(req.body)

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId } })
    if (existing) {
      return res.status(409).json({ error: 'Minutes already exist for this meeting. Use PATCH to update.' })
    }

    const minutes = await prisma.meetingMinutes.create({
      data: {
        meetingId,
        content: data.content,
        authorId: data.authorId,
      },
      include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return res.status(201).json(minutes)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating minutes:', error)
    return res.status(500).json({ error: 'Failed to create minutes' })
  }
}

async function updateMinutes(req: NextApiRequest, res: NextApiResponse, meetingId: string) {
  try {
    const data = updateMinutesSchema.parse(req.body)

    const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId } })
    if (!existing) {
      return res.status(404).json({ error: 'Minutes not found' })
    }

    const minutes = await prisma.meetingMinutes.update({
      where: { meetingId },
      data: { content: data.content },
      include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })

    return res.status(200).json(minutes)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating minutes:', error)
    return res.status(500).json({ error: 'Failed to update minutes' })
  }
}
