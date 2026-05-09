// pages/api/notifications/[id]/read.ts
// 標記單一通知為已讀
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = session.user.id

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid notification ID' })
  }

  try {
    // 確保通知屬於當前用戶
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    })

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })

    return res.status(200).json(successResponse(updated))
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return res.status(500).json({ error: 'Failed to mark as read' })
  }
}
