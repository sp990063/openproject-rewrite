import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api-response'

const updateTimeEntrySchema = z.object({
  hours: z.number().positive().optional(),
  comment: z.string().optional(),
  spentOn: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json(errorResponse('BAD_REQUEST', 'Time entry ID is required'))
  }

  switch (req.method) {
    case 'GET':
      return getTimeEntry(req, res, id)
    case 'PATCH':
      return updateTimeEntry(req, res, id)
    case 'DELETE':
      return deleteTimeEntry(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
  }
}

async function getTimeEntry(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const entry = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true }
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })

    if (!entry) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Time entry not found'))
    }

    const estimatedHours = entry.workPackage?.estimatedHours
    let overtimeHours: number | null = null

    if (estimatedHours && entry.hours > estimatedHours * 1.2) {
      overtimeHours = entry.hours - estimatedHours
    }

    const entryWithStrings = {
      ...entry,
      spentOn: entry.spentOn.toISOString(),
      approvedAt: entry.approvedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null,
      overtimeHours,
    }

    return res.status(200).json(successResponse({ entry: entryWithStrings }))
  } catch (error) {
    console.error('Error fetching time entry:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch time entry'))
  }
}

async function updateTimeEntry(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'You must be logged in'))
    }

    const data = updateTimeEntrySchema.parse(req.body)

    // Fetch the existing entry
    const existing = await prisma.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Time entry not found'))
    }

    // Only allow owner to update their own pending/rejected entries
    if (existing.userId !== session.user.id) {
      return res.status(403).json(errorResponse('FORBIDDEN', 'You can only update your own time entries'))
    }

    if (existing.status !== 'pending' && existing.status !== 'rejected') {
      return res.status(400).json(errorResponse('INVALID_STATUS', 'You can only update pending or rejected time entries'))
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...data,
        spentOn: data.spentOn ? new Date(data.spentOn) : undefined,
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

    return res.status(200).json(successResponse({ entry: entryWithStrings }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Validation failed', error.issues))
    }
    console.error('Error updating time entry:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to update time entry'))
  }
}

async function deleteTimeEntry(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'You must be logged in'))
    }

    const existing = await prisma.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Time entry not found'))
    }

    // Only allow owner to delete their own pending/rejected entries
    if (existing.userId !== session.user.id) {
      return res.status(403).json(errorResponse('FORBIDDEN', 'You can only delete your own time entries'))
    }

    if (existing.status !== 'pending' && existing.status !== 'rejected') {
      return res.status(400).json(errorResponse('INVALID_STATUS', 'You can only delete pending or rejected time entries'))
    }

    // Soft delete: set deletedAt and deletedBy
    await prisma.timeEntry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    return res.status(200).json(successResponse({ message: 'Time entry deleted' }))
  } catch (error) {
    console.error('Error deleting time entry:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to delete time entry'))
  }
}
