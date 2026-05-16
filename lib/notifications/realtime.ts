/**
 * SSE real-time broadcast using Redis pub/sub
 * Phase 6 - replaces in-memory Map with Redis for Vercel serverless compatibility
 */
import { Redis } from '@upstash/redis'
import { prisma } from '@/lib/prisma'

export interface SSEEvent {
  type: 'connected' | 'work_package.updated' | 'work_package.created' | 'notification.new' | 'member.added'
  payload: unknown
  timestamp: number
  projectId?: string
}

// Redis publisher — shared across all serverless instances
let redisPublisher: Redis | null = null

function getPublisher(): Redis {
  if (!redisPublisher) {
    redisPublisher = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    })
  }
  return redisPublisher
}

export async function broadcastToUser(userId: string, event: SSEEvent): Promise<void> {
  const redis = getPublisher()
  const channel = `sse:${userId}`
  await redis.publish(channel, JSON.stringify(event))
}

export async function broadcastToProject(
  projectId: string,
  event: SSEEvent,
  projectMembers: string[]
): Promise<void> {
  const redis = getPublisher()
  const message = JSON.stringify(event)
  await Promise.all(
    projectMembers.map(userId => redis.publish(`sse:${userId}`, message))
  )
}

export async function broadcastWorkPackageUpdate(workPackageId: string, data: unknown): Promise<void> {
  const workPackage = await prisma.workPackage.findUnique({
    where: { id: workPackageId },
    select: { projectId: true },
  })
  if (!workPackage) return

  const event: SSEEvent = {
    type: 'work_package.updated',
    payload: { id: workPackageId, ...data as object },
    timestamp: Date.now(),
    projectId: workPackage.projectId,
  }

  const members = await prisma.member.findMany({
    where: { projectId: workPackage.projectId },
    select: { userId: true },
  })

  await broadcastToProject(workPackage.projectId, event, members.map(m => m.userId))
}

export async function broadcastNotification(userId: string, notificationId: string): Promise<void> {
  const event: SSEEvent = {
    type: 'notification.new',
    payload: { id: notificationId },
    timestamp: Date.now(),
  }
  await broadcastToUser(userId, event)
}
