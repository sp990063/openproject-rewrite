import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const updateRelationSchema = z.object({
  relationType: z.enum(['blocks', 'blocked_by', 'precedes', 'follows', 'relates']).optional(),
  fromId: z.string().cuid().optional(),
  toId: z.string().cuid().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Relation ID is required' })
  }

  // Rate limiting for write methods
  if (process.env.NODE_ENV !== 'test' && req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  switch (req.method) {
    case 'GET':
      return getRelation(req, res, id)
    case 'PATCH':
      return updateRelation(req, res, id)
    case 'DELETE':
      return deleteRelation(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getRelation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const relation = await prisma.workPackageRelation.findUnique({
      where: { id },
      include: {
        from: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
        to: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
      },
    })

    if (!relation) {
      return res.status(404).json({ error: 'Relation not found' })
    }

    return res.status(200).json(relation)
  } catch (error) {
    console.error('Error fetching relation:', error)
    return res.status(500).json({ error: 'Failed to fetch relation' })
  }
}

async function updateRelation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateRelationSchema.parse(req.body)

    // Check if relation exists
    const existing = await prisma.workPackageRelation.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Relation not found' })
    }

    const relation = await prisma.workPackageRelation.update({
      where: { id },
      data: {
        ...(data.relationType !== undefined ? { relationType: data.relationType } : {}),
        ...(data.fromId !== undefined ? { fromId: data.fromId } : {}),
        ...(data.toId !== undefined ? { toId: data.toId } : {}),
      },
      include: {
        from: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
        to: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
      },
    })

    return res.status(200).json(relation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating relation:', error)
    return res.status(500).json({ error: 'Failed to update relation' })
  }
}

async function deleteRelation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Check if relation exists
    const existing = await prisma.workPackageRelation.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Relation not found' })
    }

    await prisma.workPackageRelation.delete({
      where: { id },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting relation:', error)
    return res.status(500).json({ error: 'Failed to delete relation' })
  }
}
