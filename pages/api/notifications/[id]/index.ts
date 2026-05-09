// pages/api/notifications/[id]/index.ts
// 刪除單一通知
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
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

    await prisma.notification.delete({ where: { id } })

    return res.status(200).json(successResponse({ deleted: true }))
  } catch (error) {
    console.error('Error deleting notification:', error)
    return res.status(500).json({ error: 'Failed to delete notification' })
  }
}
