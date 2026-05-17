import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api-response'

const createTimeEntrySchema = z.object({
  workPackageId: z.string(),
  hours: z.number().positive(),
  comment: z.string().optional(),
  spentOn: z.string(), // ISO date string
  userTimezone: z.string().optional().default('UTC'),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getTimeEntries(req, res)
    case 'POST':
      return createTimeEntry(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
  }
}

async function getTimeEntries(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    const { userId, projectId, workPackageId, from, to, includeDeleted } = req.query

    // Build where clause
    const where: Record<string, unknown> = {}

    // Exclude soft-deleted entries by default (M2 fix)
    if (includeDeleted !== 'true') {
      where.deletedAt = null
    }

    if (userId) where.userId = userId as string
    if (workPackageId) where.workPackageId = workPackageId as string

    // Date range filter on spentOn
    if (from || to) {
      where.spentOn = {}
      if (from) (where.spentOn as Record<string, unknown>).gte = new Date(from as string)
      if (to) (where.spentOn as Record<string, unknown>).lte = new Date(to as string)
    }

    // If projectId is provided, filter via workPackage relation
    if (projectId) {
      where.workPackage = { projectId: projectId as string }
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true }
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { spentOn: 'desc' },
    })

    // Compute overtimeHours warning if hours > estimatedHours * 1.2
    const entriesWithOvertime = entries.map((entry) => {
      const estimatedHours = entry.workPackage?.estimatedHours
      let overtimeHours: number | null = null

      if (estimatedHours && entry.hours > estimatedHours * 1.2) {
        overtimeHours = entry.hours - estimatedHours
      }

      return {
        ...entry,
        spentOn: entry.spentOn.toISOString(),
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        deletedAt: entry.deletedAt?.toISOString() ?? null,
        overtimeHours,
      }
    })

    return res.status(200).json(successResponse({ entries: entriesWithOvertime }))
  } catch (error) {
    console.error('Error fetching time entries:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch time entries'))
  }
}

async function createTimeEntry(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'You must be logged in'))
    }

    const data = createTimeEntrySchema.parse(req.body)

    // Use session user as the creator if userId not provided
    const userId = session.user.id

    const entry = await prisma.timeEntry.create({
      data: {
        workPackageId: data.workPackageId,
        userId,
        hours: data.hours,
        comment: data.comment,
        spentOn: new Date(data.spentOn),
        userTimezone: data.userTimezone,
        status: 'pending',
      },
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true }
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })

    const entryWithStrings = {
      ...entry,
      spentOn: entry.spentOn.toISOString(),
      approvedAt: entry.approvedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null,
    }

    return res.status(201).json(successResponse({ entry: entryWithStrings }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Validation failed', error.issues))
    }
    console.error('Error creating time entry:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create time entry'))
  }
}
