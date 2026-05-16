import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Redis } from '@upstash/redis'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const userId = (session.user as any).id || (session.user as any).sub
  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  })
  const channel = `sse:${userId}`

  // Subscribe to user's personal Redis channel
  const subscriber = redis.duplicate()
  await subscriber.subscribe(channel)

  subscriber.on('message', (ch: string, message: string) => {
    if (ch !== channel) return
    try {
      res.write(`data: ${message}\n\n`)
    } catch {
      // Client disconnected
    }
  })

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)

  // Heartbeat every 25s (below nginx 30s timeout)
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`)
    } catch {
      clearInterval(heartbeat)
    }
  }, 25000)

  // Cleanup on disconnect
  req.socket.on('close', async () => {
    clearInterval(heartbeat)
    try {
      await subscriber.unsubscribe(channel)
      await subscriber.quit()
    } catch {
      // ignore
    }
  })
}
