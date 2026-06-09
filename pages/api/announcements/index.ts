import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions, isSystemAdmin } from '@/lib/auth'
import { z } from 'zod'

const createAnnouncementSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  dismissible: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (B-3.0 P0 fix: GET was previously unauthenticated, leaking admin
  // announcements to anonymous users). All announcements are global, so no
  // project-membership check is required — just session presence.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return listActiveAnnouncements(req, res, session.user.id)
    case 'POST':
      return createAnnouncement(req, res, session.user.id)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * GET /api/announcements - List active announcements (checks date range)
 */
async function listActiveAnnouncements(req: NextApiRequest, res: NextApiResponse, _userId: string) {
  try {
    const now = new Date()

    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json(announcements)
  } catch (error) {
    console.error('Error listing announcements:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * POST /api/announcements - Create a new announcement (admin only).
 * Auth gate runs in the outer handler (B-3.0 P0 fix) so this body just
 * needs the admin check.
 */
async function createAnnouncement(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const isAdmin = await isSystemAdmin(userId)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Admin only' })
    }

    const body = createAnnouncementSchema.parse(req.body)

    const announcement = await prisma.announcement.create({
      data: {
        content: body.content,
        type: body.type,
        dismissible: body.dismissible,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      },
    })

    return res.status(201).json(announcement)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues })
    }
    console.error('Error creating announcement:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
