import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { isSystemAdmin } from '@/lib/auth'
import { z } from 'zod'

const updateAnnouncementSchema = z.object({
  content: z.string().min(1).optional(),
  type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  dismissible: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid announcement ID' })
  }

  switch (req.method) {
    case 'PUT':
      return updateAnnouncement(req, res, id)
    case 'DELETE':
      return deleteAnnouncement(req, res, id)
    default:
      res.setHeader('Allow', ['PUT', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * PUT /api/announcements/[id] - Update an announcement (admin only)
 */
async function updateAnnouncement(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const session = req.headers['x-user-id']
      ? { userId: req.headers['x-user-id'] as string }
      : null

    if (!session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const isAdmin = await isSystemAdmin(session.userId)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Admin only' })
    }

    const body = updateAnnouncementSchema.parse(req.body)

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...(body.content !== undefined && { content: body.content }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.dismissible !== undefined && { dismissible: body.dismissible }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt ? new Date(body.endsAt) : null }),
      },
    })

    return res.status(200).json(announcement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues })
    }
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return res.status(404).json({ error: 'Announcement not found' })
    }
    console.error('Error updating announcement:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * DELETE /api/announcements/[id] - Delete an announcement (admin only)
 */
async function deleteAnnouncement(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const session = req.headers['x-user-id']
      ? { userId: req.headers['x-user-id'] as string }
      : null

    if (!session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const isAdmin = await isSystemAdmin(session.userId)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Admin only' })
    }

    await prisma.announcement.delete({
      where: { id },
    })

    return res.status(204).send(null)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to delete')) {
      return res.status(404).json({ error: 'Announcement not found' })
    }
    console.error('Error deleting announcement:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
