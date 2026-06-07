import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const wipLimitsSchema = z.object({
  statusId: z.string(),
  limit: z.number().int().min(0).nullable(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { query } = req
  const projectId = query.projectId as string

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getWipLimits(req, res, projectId)
    case 'PATCH':
      return updateWipLimit(req, res, projectId)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWipLimits(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const limits = await prisma.projectWipLimit.findMany({
      where: { projectId },
    })
    return res.status(200).json(limits)
  } catch (error) {
    console.error('Error fetching WIP limits:', error)
    return res.status(500).json({ error: 'Failed to fetch WIP limits' })
  }
}

async function updateWipLimit(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const { statusId, limit } = wipLimitsSchema.parse(req.body)

    const wipLimit = await prisma.projectWipLimit.upsert({
      where: {
        projectId_statusId: { projectId, statusId },
      },
      create: {
        projectId,
        statusId,
        limit,
      },
      update: {
        limit,
      },
    })

    return res.status(200).json(wipLimit)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating WIP limit:', error)
    return res.status(500).json({ error: 'Failed to update WIP limit' })
  }
}
