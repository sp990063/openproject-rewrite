// pages/api/notification-settings/index.ts
// 通知設置 API - GET 列表, PATCH  upsert 設置
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'
import { z } from 'zod'

const upsertSettingSchema = z.object({
  notificationType: z.string(),
  projectId: z.string().nullable().optional(),
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  digestEnabled: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const userId = session.user.id

  switch (req.method) {
    case 'GET':
      return getSettings(req, res, userId)
    case 'PATCH':
      return upsertSetting(req, res, userId)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getSettings(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const settings = await prisma.notificationSetting.findMany({
      where: { userId },
      orderBy: [{ projectId: 'asc' }, { notificationType: 'asc' }],
    })

    return res.status(200).json(successResponse({ settings }))
  } catch (error) {
    console.error('Error fetching notification settings:', error)
    return res.status(500).json({ error: 'Failed to fetch settings' })
  }
}

async function upsertSetting(req: NextApiRequest, res: NextApiResponse, userId: string) {
  try {
    const data = upsertSettingSchema.parse(req.body)

    const { notificationType, projectId, emailEnabled, inAppEnabled, digestEnabled } = data

    // 使用 upsert 根據 unique key 更新或創建
    const setting = await prisma.notificationSetting.upsert({
      where: {
        userId_projectId_notificationType: {
          userId,
          projectId: (projectId ?? null) as string | null,
          notificationType,
        },
      },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(inAppEnabled !== undefined && { inAppEnabled }),
        ...(digestEnabled !== undefined && { digestEnabled }),
      },
      create: {
        userId,
        projectId: projectId ?? null,
        notificationType,
        emailEnabled: emailEnabled ?? true,
        inAppEnabled: inAppEnabled ?? true,
        digestEnabled: digestEnabled ?? false,
      },
    })

    return res.status(200).json(successResponse(setting))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error upserting notification setting:', error)
    return res.status(500).json({ error: 'Failed to upsert setting' })
  }
}
