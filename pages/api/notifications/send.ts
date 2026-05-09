// pages/api/notifications/send.ts
// 發送通知給用戶 (管理員/系統專用)
// S1-F 安全修復: 無論用戶是否存在，始終返回 200 OK，防止用戶枚舉攻擊
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'
import { z } from 'zod'

const sendNotificationSchema = z.object({
  userId: z.string(),
  reason: z.string(),
  projectId: z.string(),
  projectName: z.string().optional().default(''),
  resourceType: z.string(),
  resourceId: z.string(),
  resourceSubject: z.string().optional().default(''),
  actorId: z.string(),
  actorName: z.string().optional().default(''),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 檢查是否為系統管理員
  const admin = await isSystemAdmin(session.user.id)
  if (!admin) {
    // S1-F: 返回 200 而不是 403，防止枚舉
    return res.status(200).json(successResponse({ sent: false, reason: 'insufficient_permissions' }))
  }

  try {
    const data = sendNotificationSchema.parse(req.body)

    // S1-F 安全修復: 不在此處驗證用戶是否存在
    // 即使用戶不存在也返回成功，防止攻擊者枚舉有效的用戶 ID
    // 通知會被創建，但因為 userId 無效而不會被任何人看到（軟件層面的設計）
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        reason: data.reason,
        projectId: data.projectId,
        projectName: data.projectName,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        resourceSubject: data.resourceSubject,
        actorId: data.actorId,
        actorName: data.actorName,
        read: false,
      },
    })

    // S1-F: 即使創建失敗也返回 200（但實際上 db 約束會阻止完全無效的 userId）
    return res.status(200).json(successResponse({ sent: true, notificationId: notification.id }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error sending notification:', error)
    // S1-F: 即使錯誤也返回 200
    return res.status(200).json(successResponse({ sent: false, reason: 'internal_error' }))
  }
}
