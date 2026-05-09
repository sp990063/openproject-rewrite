// pages/api/notifications/index.ts
// 通知列表 API - GET 分頁查詢, POST 全部標為已讀
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = session.user.id

  switch (req.method) {
    case 'GET':
      return getNotifications(req, res, userId)
    case 'POST':
      return markAllRead(req, res, userId)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getNotifications(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const { page = '1', perPage = '20', unread } = req.query
    const pageNum = Math.max(1, parseInt(page as string, 10))
    const perPageNum = Math.min(100, Math.max(1, parseInt(perPage as string, 10)))
    const skip = (pageNum - 1) * perPageNum

    const where: {
      userId: string
      read?: boolean
    } = { userId }
    if (unread === 'true') where.read = false

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPageNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ])

    return res.status(200).json(successResponse({
      notifications,
      meta: {
        page: pageNum,
        perPage: perPageNum,
        total,
        totalPages: Math.ceil(total / perPageNum),
        unreadCount,
      },
    }))
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return res.status(500).json({ error: 'Failed to fetch notifications' })
  }
}

async function markAllRead(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
    return res.status(200).json(successResponse({ updated: true }))
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return res.status(500).json({ error: 'Failed to mark all as read' })
  }
}
