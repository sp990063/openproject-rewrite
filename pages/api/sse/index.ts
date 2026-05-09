// pages/api/sse/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore - next-auth types are complex
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Check for Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.REDIS_TOKEN;

  if (!redisUrl || !redisToken) {
    // SSE without Redis — send a single connected event then close
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
    res.end();
    return;
  }

  let subscriber: any = null;
  try {
    const Redis = require('ioredis');
    subscriber = new Redis(redisUrl, { token: redisToken, maxRetriesPerRequest: 1 });
    
    const channel = `sse:${userId}`;
    await subscriber.subscribe(channel);

    subscriber.on('message', (ch: string, message: string) => {
      if (ch !== channel) return;
      try {
        res.write(`data: ${message}\n\n`);
      } catch {
        // Client disconnected
      }
    });

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    // Heartbeat every 25s
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    // Cleanup on disconnect
    req.socket.on('close', async () => {
      clearInterval(heartbeat);
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch {}
    });
  } catch (e) {
    console.error('[SSE] Failed to setup SSE:', e);
    // Send connected event even if Redis fails
    try {
      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
      res.end();
    } catch {}
  }
}
