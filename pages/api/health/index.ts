import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`
    
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      services: {
        database: 'connected',
        cache: process.env.UPSTASH_REDIS_REST_URL ? 'configured' : 'not_configured',
      }
    })
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
      },
      error: String(error),
    })
  }
}
