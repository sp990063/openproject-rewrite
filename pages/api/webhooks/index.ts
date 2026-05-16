import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { isValidWebhookEvent, WEBHOOK_EVENTS } from '@/lib/webhooks/event-types'
import { z } from 'zod'

const createWebhookSchema = z.object({
  url: z.string().url(),
  projectId: z.string().optional().nullable(),
  secret: z.string().optional(),
  events: z.array(z.string()).min(1),
  active: z.boolean().default(true),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return listWebhooks(req, res)
    case 'POST':
      return createWebhook(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

/**
 * GET /api/webhooks - List all webhooks (system-wide + optionally filtered by project)
 */
async function listWebhooks(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId } = req.query

    const where = projectId
      ? { projectId: projectId as string }
      : {} // Returns all if no filter

    const webhooks = await prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true, identifier: true } },
        _count: { select: { deliveries: true } },
      },
    })

    return res.status(200).json(webhooks)
  } catch (error) {
    console.error('Error listing webhooks:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * POST /api/webhooks - Create a new webhook
 */
async function createWebhook(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = createWebhookSchema.parse(req.body)

    // Validate events
    for (const event of body.events) {
      if (!isValidWebhookEvent(event)) {
        return res.status(400).json({
          error: `Invalid event: ${event}. Valid events: ${WEBHOOK_EVENTS.join(', ')}`,
        })
      }
    }

    // Validate project exists if provided
    if (body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
      })
      if (!project) {
        return res.status(400).json({ error: 'Project not found' })
      }
    }

    const webhook = await prisma.webhook.create({
      data: {
        url: body.url,
        projectId: body.projectId ?? null,
        secret: body.secret ?? null,
        events: body.events,
        active: body.active,
      },
      include: {
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    return res.status(201).json(webhook)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error creating webhook:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
