import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json(errorResponse('BAD_REQUEST', 'Work package ID is required'))
  }

  try {
    const { includeDeleted } = req.query

    // Build where clause
    const where: Record<string, unknown> = {
      workPackageId: id,
    }

    // Exclude soft-deleted entries by default (M2 fix)
    if (includeDeleted !== 'true') {
      where.deletedAt = null
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
    console.error('Error fetching work package time entries:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch time entries'))
  }
}
