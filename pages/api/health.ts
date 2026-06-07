// pages/api/health.ts
// Phase 6 Sprint 2: liveness + readiness probe.
//
//   GET /api/health       — full health check (DB + Redis), returns 503 if degraded
//   GET /api/health?live  — liveness only (always 200 if the process is up)
//
// Uptime checkers (Better Uptime / UptimeRobot) can hit `?live=1` every
// 30s and `?full=1` (default) every 5min. Returns JSON with per-check
// status + latency.
//
// Auth: NOT required. This is by design — uptime monitors don't have
// user accounts. The endpoint is read-only and reveals no PII (just
// up/down + latency per service). A determined attacker could DoS by
// hammering it, but the route does at most 2 cheap DB/Redis pings.
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { Redis } from '@upstash/redis'

interface HealthCheck {
  ok: boolean
  latencyMs?: number
  error?: string
}

async function pingDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : 'DB error',
    }
  }
}

async function pingRedis(): Promise<HealthCheck> {
  const start = Date.now()
  const url = process.env.UPSTASH_REDIS_URL
  const token = process.env.UPSTASH_REDIS_TOKEN
  if (!url || !token) {
    return { ok: false, error: 'Redis not configured' }
  }
  try {
    const redis = new Redis({ url, token })
    await redis.ping()
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : 'Redis error',
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // Liveness — the process is alive and able to respond. No external checks.
  // Uptime monitors should hit ?live=1 every 30s.
  if (req.query.live === '1') {
    return res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() })
  }

  // Full health — DB + Redis. `Promise.all` runs both pings in parallel.
  const [database, redis] = await Promise.all([pingDatabase(), pingRedis()])
  const checks: Record<string, HealthCheck> = { database, redis }
  const allOk = Object.values(checks).every((c) => c.ok)

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  })
}
