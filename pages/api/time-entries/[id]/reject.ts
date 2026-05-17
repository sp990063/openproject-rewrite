import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api-response'

const rejectSchema = z.object({
  reason: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json(errorResponse('BAD_REQUEST', 'Time entry ID is required'))
  }

  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json(errorResponse('UNAUTHORIZED', 'You must be logged in'))
    }

    const data = rejectSchema.parse(req.body)

    const existing = await prisma.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json(errorResponse('NOT_FOUND', 'Time entry not found'))
    }

    if (existing.status !== 'submitted') {
      return res.status(400).json(errorResponse('INVALID_STATUS', 'You can only reject submitted time entries'))
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: data.reason ?? null,
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
    console.error('Error rejecting time entry:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to reject time entry'))
  }
}
