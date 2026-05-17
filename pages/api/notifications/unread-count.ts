// pages/api/notifications/unread-count.ts
// 獲取未讀通知數量
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = session.user.id

  try {
    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    })

    return res.status(200).json(successResponse({ unreadCount }))
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return res.status(500).json({ error: 'Failed to fetch unread count' })
  }
}
