// pages/api/notifications/index.ts
// 通知列表 API - GET 分頁查詢, POST 全部標為已讀
// Refactored to use withRoute HOF (Phase 1 of migration plan)
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  unread: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
})

export default withRoute<unknown, z.input<typeof querySchema>, unknown>(
  async ({ req, res, session, query }) => {
    const userId = session.user.id

    // POST /api/notifications — mark all as read
    if (req.method === 'POST') {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      })
      return res.status(200).json({ success: true, data: { updated: true } })
    }

    // GET /api/notifications — paginated list
    const skip = (query.page - 1) * query.perPage

    const where: { userId: string; read?: boolean } = { userId }
    if (query.unread) where.read = false

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.perPage,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, read: false } }),
    ])

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        meta: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages: Math.ceil(total / query.perPage),
          unreadCount,
        },
      },
    })
  },
  {
    methods: ['GET', 'POST'],
    querySchema,
  }
)
