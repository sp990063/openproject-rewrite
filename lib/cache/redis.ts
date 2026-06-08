/**
 * Redis cache layer using @upstash/redis
 * Used for performance optimization in Phase 6
 */
import { Redis } from '@upstash/redis'

// Initialize Redis client (uses UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN)
let redis: Redis | null = null
let warnedNoRedis = false

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    if (!warnedNoRedis) {
      console.warn(
        '[cache] Upstash Redis not configured (UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN missing). Cache calls will no-op.'
      )
      warnedNoRedis = true
    }
    return null
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    })
  }
  return redis
}

// -----------------------------------------------------------------------------
// Core cache operations
// -----------------------------------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    if (!client) return null
    const data = await client.get<T>(key)
    return data
  } catch (error) {
    console.warn(`[cache] Get failed for key ${key}:`, error)
    return null
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    const client = getRedis()
    if (!client) return
    await client.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    console.warn(`[cache] Set failed for key ${key}:`, error)
  }
}

export async function cacheInvalidate(key: string): Promise<void> {
  try {
    const client = getRedis()
    if (!client) return
    await client.del(key)
  } catch (error) {
    console.warn(`[cache] Invalidate failed for key ${key}:`, error)
  }
}

// -----------------------------------------------------------------------------
// TTL constants
// -----------------------------------------------------------------------------

export const TTL = {
  USER_PROFILE: 30 * 60,        // 30 minutes
  USER_SETTINGS: 60 * 60,        // 1 hour
  PROJECT_SUMMARY: 15 * 60,      // 15 minutes
  PROJECT_MEMBERS: 5 * 60,       // 5 minutes
  WORK_PACKAGE_DETAIL: 10 * 60,  // 10 minutes
  WORK_PACKAGE_LIST: 5 * 60,     // 5 minutes
  NOTIFICATION_COUNT: 30,         // 30 seconds
  QUERY_RESULT: 5 * 60,          // 5 minutes
} as const

// -----------------------------------------------------------------------------
// User cache helpers
// -----------------------------------------------------------------------------

export async function getCachedUserProfile(
  userId: string
): Promise<{ id: string; name: string; email: string; avatarUrl?: string } | null> {
  return cacheGet(`user:${userId}:profile`)
}

export async function setCachedUserProfile(
  userId: string,
  profile: { id: string; name: string; email: string; avatarUrl?: string }
): Promise<void> {
  await cacheSet(`user:${userId}:profile`, profile, TTL.USER_PROFILE)
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    cacheInvalidate(`user:${userId}:profile`),
    cacheInvalidate(`user:${userId}:settings`),
  ])
}

// -----------------------------------------------------------------------------
// Project cache helpers
// -----------------------------------------------------------------------------

export async function getCachedProjectSummary(projectId: string) {
  return cacheGet<{ id: string; name: string; identifier: string; description: string }>(
    `project:${projectId}:summary`
  )
}

export async function setCachedProjectSummary(
  projectId: string,
  summary: { id: string; name: string; identifier: string; description: string }
): Promise<void> {
  await cacheSet(`project:${projectId}:summary`, summary, TTL.PROJECT_SUMMARY)
}

export async function getCachedProjectMembers(
  projectId: string
): Promise<Array<{ userId: string; name: string; role: string }> | null> {
  return cacheGet(`project:${projectId}:members`)
}

export async function setCachedProjectMembers(
  projectId: string,
  members: Array<{ userId: string; name: string; role: string }>
): Promise<void> {
  await cacheSet(`project:${projectId}:members`, members, TTL.PROJECT_MEMBERS)
}

export async function invalidateProjectCache(projectId: string): Promise<void> {
  await Promise.all([
    cacheInvalidate(`project:${projectId}:summary`),
    cacheInvalidate(`project:${projectId}:members`),
  ])
}

// -----------------------------------------------------------------------------
// Work package cache helpers
// -----------------------------------------------------------------------------

export async function getCachedWorkPackageDetail(workPackageId: string) {
  return cacheGet<any>(`work-package:${workPackageId}:detail`)
}

export async function setCachedWorkPackageDetail(
  workPackageId: string,
  data: any
): Promise<void> {
  await cacheSet(`work-package:${workPackageId}:detail`, data, TTL.WORK_PACKAGE_DETAIL)
}

export async function invalidateWorkPackageCache(workPackageId: string): Promise<void> {
  await Promise.all([
    cacheInvalidate(`work-package:${workPackageId}:detail`),
    cacheInvalidate(`work-package:${workPackageId}:list`),
  ])
}

// -----------------------------------------------------------------------------
// Notification cache helpers
// -----------------------------------------------------------------------------

export async function getCachedUnreadCount(userId: string): Promise<number | null> {
  return cacheGet<number>(`notification:${userId}:unread-count`)
}

export async function setCachedUnreadCount(userId: string, count: number): Promise<void> {
  await cacheSet(`notification:${userId}:unread-count`, count, TTL.NOTIFICATION_COUNT)
}

export async function invalidateUnreadCount(userId: string): Promise<void> {
  await cacheInvalidate(`notification:${userId}:unread-count`)
}
