import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})

const createWorkPackageSchema = z.object({
  projectId: z.string().cuid(),
  subject: z.string().min(1).max(255),
  description: z.string().optional(),
  statusId: z.string().cuid(),
  typeId: z.string().cuid(),
  priorityId: z.string().cuid(),
  assigneeId: z.string().cuid().optional(),
  authorId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().optional(),
  parentId: z.string().cuid().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limiting for write methods
  if (req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const { success } = await ratelimit.limit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  switch (req.method) {
    case 'GET':
      return getWorkPackages(req, res)
    case 'POST':
      return createWorkPackage(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWorkPackages(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId, statusId, assigneeId } = req.query

    const where: Record<string, string> = {}
    if (projectId) where.projectId = projectId as string
    if (statusId) where.statusId = statusId as string
    if (assigneeId) where.assigneeId = assigneeId as string

    const workPackages = await prisma.workPackage.findMany({
      where,
      include: {
        project: true,
        status: true,
        type: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    })

    return res.status(200).json(workPackages)
  } catch (error) {
    console.error('Error fetching work packages:', error)
    return res.status(500).json({ error: 'Failed to fetch work packages' })
  }
}

async function createWorkPackage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createWorkPackageSchema.parse(req.body)

    // Get max position for the project
    const maxPosition = await prisma.workPackage.aggregate({
      where: { projectId: data.projectId },
      _max: { position: true },
    })

    const workPackage = await prisma.workPackage.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        position: (maxPosition._max.position ?? -1) + 1,
      },
      include: {
        project: true,
        status: true,
        type: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    // Create activity
    await prisma.activity.create({
      data: {
        workPackageId: workPackage.id,
        userId: data.authorId,
        action: 'created',
        details: { subject: data.subject },
      },
    })

    return res.status(201).json(workPackage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating work package:', error)
    return res.status(500).json({ error: 'Failed to create work package' })
  }
}
