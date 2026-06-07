// pages/api/notifications/unread-count.ts
// Get the unread notification count for the current user.
//
// Phase 6 Sprint 1: wired into the Redis cache layer. 30s TTL per
// `lib/cache/redis.ts:TTL.NOTIFICATION_COUNT` — short enough that the
// SSE-driven invalidation isn't required for correctness, but long
// enough that the count is cached for 30s windows and reduces DB load
// when many tabs are open.
//
// Cache key: `notification:${userId}:unread-count`.
//
// Pre-existing implementation hit Prisma on every poll. This adds the
// cache with no behavioral change for callers — `successResponse({ unreadCount })`
// envelope preserved exactly.
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'
import {
  getCachedUnreadCount,
  setCachedUnreadCount,
} from '@/lib/cache/redis'

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
    // Try cache first. cacheGet returns null on miss or on Redis error
    // (the helper catches and warns, so a Redis outage degrades to a
    // direct Prisma read — same shape as the pre-existing code).
    const cached = await getCachedUnreadCount(userId)
    if (cached !== null) {
      return res.status(200).json(successResponse({ unreadCount: cached }))
    }

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    })

    // Populate the cache (best-effort — fires and forgets; failure
    // shouldn't fail the response).
    await setCachedUnreadCount(userId, unreadCount)

    return res.status(200).json(successResponse({ unreadCount }))
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return res.status(500).json({ error: 'Failed to fetch unread count' })
  }
}
