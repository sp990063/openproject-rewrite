import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAgendaItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  notes: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const { id, agendaId } = query

  if (!id || !agendaId) {
    return res.status(400).json({ error: 'Meeting ID and Agenda Item ID are required' })
  }

  switch (req.method) {
    case 'PATCH':
      return updateAgendaItem(req, res, id as string, agendaId as string)
    case 'DELETE':
      return deleteAgendaItem(req, res, id as string, agendaId as string)
    default:
      res.setHeader('Allow', ['PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function updateAgendaItem(req: NextApiRequest, res: NextApiResponse, meetingId: string, agendaId: string) {
  try {
    const data = updateAgendaItemSchema.parse(req.body)

    const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: agendaId } })
    if (!existing) {
      return res.status(404).json({ error: 'Agenda item not found' })
    }

    if (existing.meetingId !== meetingId) {
      return res.status(400).json({ error: 'Agenda item does not belong to this meeting' })
    }

    const item = await prisma.meetingAgendaItem.update({
      where: { id: agendaId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.position !== undefined && { position: data.position }),
      },
    })

    return res.status(200).json(item)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating agenda item:', error)
    return res.status(500).json({ error: 'Failed to update agenda item' })
  }
}

async function deleteAgendaItem(req: NextApiRequest, res: NextApiResponse, meetingId: string, agendaId: string) {
  try {
    const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: agendaId } })
    if (!existing) {
      return res.status(404).json({ error: 'Agenda item not found' })
    }

    if (existing.meetingId !== meetingId) {
      return res.status(400).json({ error: 'Agenda item does not belong to this meeting' })
    }

    await prisma.meetingAgendaItem.delete({ where: { id: agendaId } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting agenda item:', error)
    return res.status(500).json({ error: 'Failed to delete agenda item' })
  }
}
