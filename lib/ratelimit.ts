import Redis from 'ioredis'
import { RateLimiterRedis } from 'rate-limiter-flexible'

// Lazily initialise Redis — avoids crashing the process if Redis is unavailable.
// If Redis fails, rate limiting is skipped (all requests allowed through).
let redis: Redis | null = null
let ratelimit: RateLimiterRedis | null = null

function getRatelimiter(): RateLimiterRedis | null {
  if (ratelimit) return ratelimit

  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableOfflineQueue: false,   // fail fast — don't queue if disconnected
      lazyConnect: true,
    })

    // Attempt a ping; if it throws, Redis is unreachable — degrade gracefully
    redis.connect().catch(() => {
      // Redis unavailable — discard client so getRatelimiter returns null
      redis = null
      ratelimit = null
    })

    ratelimit = new RateLimiterRedis({
      storeClient: redis,
      points: 10,
      duration: 1,
      rejectIfFailed: false,
    })

    return ratelimit
  } catch {
    return null
  }
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  const limiter = getRatelimiter()
  if (!limiter) return true   // degraded: allow all requests

  try {
    const result = await limiter.consume(ip)
    return result.success
  } catch {
    return true   // Redis error: allow rather than block
  }
}
