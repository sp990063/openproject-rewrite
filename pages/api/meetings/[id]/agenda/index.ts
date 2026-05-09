import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAgendaItemSchema = z.object({
  title: z.string().min(1).max(255),
  notes: z.string().optional().default(''),
  duration: z.number().int().positive().optional(),
  position: z.number().int().min(0).optional().default(0),
})

const updateAgendaItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  notes: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Meeting ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getAgendaItems(req, res, id)
    case 'POST':
      return createAgendaItem(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getAgendaItems(req: NextApiRequest, res: NextApiResponse, meetingId: string) {
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const items = await prisma.meetingAgendaItem.findMany({
      where: { meetingId },
      orderBy: { position: 'asc' },
    })

    return res.status(200).json(items)
  } catch (error) {
    console.error('Error fetching agenda items:', error)
    return res.status(500).json({ error: 'Failed to fetch agenda items' })
  }
}

async function createAgendaItem(req: NextApiRequest, res: NextApiResponse, meetingId: string) {
  try {
    const data = createAgendaItemSchema.parse(req.body)

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' })
    }

    const item = await prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        title: data.title,
        notes: data.notes || null,
        duration: data.duration ?? null,
        position: data.position,
      },
    })

    return res.status(201).json(item)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating agenda item:', error)
    return res.status(500).json({ error: 'Failed to create agenda item' })
  }
}
