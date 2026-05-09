import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

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
}).refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.startDate) <= new Date(data.dueDate)
    }
    return true
  },
  { message: 'dueDate must be >= startDate', path: ['dueDate'] }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limiting for write methods (skip in test environment)
  if (process.env.NODE_ENV !== 'test' && req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
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
    const {
      projectId,
      statusId,
      assigneeId,
      startDateGte,
      startDateLte,
      dueDateGte,
      dueDateLte,
    } = req.query

    // Build a Prisma where clause with AND conditions for date range filtering
    // CRITICAL: Date range filtering happens server-side, NOT client-side.
    // The calendar view sends startDateGte/startDateLte to fetch only work packages
    // whose startDate OR dueDate falls within the visible range.
    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId as string
    if (statusId) where.statusId = statusId as string
    if (assigneeId) where.assigneeId = assigneeId as string

    // Server-side date range: work packages that have ANY overlap with the visible range.
    // A WP overlaps if: WP.startDate <= rangeEnd AND WP.dueDate >= rangeStart
    // We use OR to match work packages that EITHER have their start OR due date in range,
    // or whose span covers the range. This ensures we don't miss any WP visible on the calendar.
    const dateFilters: unknown[] = []
    if (startDateGte || startDateLte || dueDateGte || dueDateLte) {
      const rangeStart = startDateGte as string | undefined
      const rangeEnd = startDateLte as string | undefined

      // WP overlaps the visible window if:
      // (startDate <= rangeEnd) AND (dueDate >= rangeStart)
      // For WPs with only startDate (no dueDate): treat dueDate = startDate
      // For WPs with only dueDate (no startDate): treat startDate = dueDate
      dateFilters.push({
        OR: [
          // Case 1: WP has both startDate and dueDate
          {
            AND: [
              { startDate: { not: null } },
              { dueDate: { not: null } },
              { startDate: rangeEnd ? { lte: new Date(rangeEnd) } : undefined },
              { dueDate: rangeStart ? { gte: new Date(rangeStart) } : undefined },
            ],
          },
          // Case 2: WP has only startDate (no dueDate) - spans from startDate indefinitely
          {
            AND: [
              { startDate: { not: null } },
              { dueDate: null },
              { startDate: rangeEnd ? { lte: new Date(rangeEnd) } : undefined },
            ],
          },
          // Case 3: WP has only dueDate (no startDate) - spans up to dueDate
          {
            AND: [
              { startDate: null },
              { dueDate: { not: null } },
              { dueDate: rangeStart ? { gte: new Date(rangeStart) } : undefined },
            ],
          },
          // Case 4: WP has neither startDate nor dueDate - shown always (not filtered by date)
          {
            AND: [{ startDate: null }, { dueDate: null }],
          },
        ],
      })
    }

    if (dateFilters.length > 0) {
      where.AND = dateFilters
    }

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
