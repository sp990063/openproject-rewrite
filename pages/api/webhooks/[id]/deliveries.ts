import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing webhook ID' })
  }

  switch (req.method) {
    case 'GET':
      return getDeliveries(req, res, id)
    default:
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * GET /api/webhooks/[id]/deliveries - Get delivery history for a webhook
 */
async function getDeliveries(req: NextApiRequest, res: NextApiResponse, webhookId: string) {
  try {
    // Verify webhook exists
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    })

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' })
    }

    // Pagination params
    const { limit = '50', offset = '0', status } = req.query

    const where: Record<string, unknown> = { webhookId }
    if (status && typeof status === 'string') {
      where.status = status
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    })

    const total = await prisma.webhookDelivery.count({ where })

    return res.status(200).json({
      deliveries,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    })
  } catch (error) {
    console.error('Error fetching deliveries:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
