import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Work package ID is required' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // Rate limiting
  if (process.env.NODE_ENV !== 'test') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  try {
    const activities = await prisma.activity.findMany({
      where: { workPackageId: id },
      include: {
        workPackage: {
          select: {
            id: true,
            subject: true,
            statusId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Resolve userId -> user name/email via a separate efficient query
    const userIds = [...new Set(activities.map((a) => a.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    const activitiesWithUsers = activities.map((a) => ({
      ...a,
      user: userMap[a.userId] ?? { id: a.userId, name: 'Unknown', email: '', avatarUrl: null },
    }))

    return res.status(200).json(activitiesWithUsers)
  } catch (error) {
    console.error('Error fetching activities:', error)
    return res.status(500).json({ error: 'Failed to fetch activities' })
  }
}
