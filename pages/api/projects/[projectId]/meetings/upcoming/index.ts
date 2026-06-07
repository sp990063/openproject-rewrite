/**
 * GET /api/projects/[projectId]/meetings/upcoming
 *
 * List upcoming meetings for a project (startTime >= now).
 * Used by the meetings list page and the project dashboard widget.
 *
 * Sprint 4 (Meetings) — adds the project-scoped "upcoming only" view
 * (the pre-existing list endpoint returns all meetings regardless of date).
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { query } = req
  const projectId = query.projectId as string
  const limitParam = (query.limit as string | undefined) ?? '10'

  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' })
  }

  const limit = Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 100)
  const now = new Date()

  try {
    const meetings = await prisma.meeting.findMany({
      where: { projectId, startTime: { gte: now } },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        _count: { select: { agenda: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    })

    return res.status(200).json({ meetings })
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error)
    return res.status(500).json({ error: 'Failed to fetch upcoming meetings' })
  }
}
