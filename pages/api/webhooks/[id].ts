import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { isValidWebhookEvent, WEBHOOK_EVENTS } from '@/lib/webhooks/event-types'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  projectId: z.string().optional().nullable(),
  secret: z.string().optional().nullable(),
  events: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
})

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
      return getWebhook(req, res, id)
    case 'PUT':
    case 'PATCH':
      return updateWebhook(req, res, id)
    case 'DELETE':
      return deleteWebhook(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * GET /api/webhooks/[id] - Get a single webhook
 */
async function getWebhook(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, identifier: true } },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { deliveries: true } },
      },
    })

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' })
    }

    return res.status(200).json(webhook)
  } catch (error) {
    console.error('Error fetching webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * PUT/PATCH /api/webhooks/[id] - Update a webhook
 */
async function updateWebhook(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const existing = await prisma.webhook.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' })
    }

    const body = updateWebhookSchema.parse(req.body)

    // Validate events if provided
    if (body.events) {
      for (const event of body.events) {
        if (!isValidWebhookEvent(event)) {
          return res.status(400).json({
            error: `Invalid event: ${event}. Valid events: ${WEBHOOK_EVENTS.join(', ')}`,
          })
        }
      }
    }

    // Validate project exists if provided
    if (body.projectId !== undefined) {
      if (body.projectId !== null) {
        const project = await prisma.project.findUnique({
          where: { id: body.projectId },
        })
        if (!project) {
          return res.status(400).json({ error: 'Project not found' })
        }
      }
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        url: body.url,
        projectId: body.projectId !== undefined ? body.projectId : existing.projectId,
        secret: body.secret !== undefined ? body.secret : existing.secret,
        events: body.events,
        active: body.active,
      },
      include: {
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    return res.status(200).json(webhook)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error updating webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * DELETE /api/webhooks/[id] - Delete a webhook
 */
async function deleteWebhook(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const existing = await prisma.webhook.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Webhook not found' })
    }

    await prisma.webhook.delete({ where: { id } })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
