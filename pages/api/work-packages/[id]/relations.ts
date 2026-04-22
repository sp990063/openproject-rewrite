import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

const createRelationSchema = z.object({
  fromId: z.string().cuid(),
  toId: z.string().cuid(),
  relationType: z.enum(['blocks', 'blocked_by', 'precedes', 'follows', 'relates']),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Work package ID is required' })
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
      return getRelations(req, res, id)
    case 'POST':
      return createRelation(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getRelations(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const relations = await prisma.workPackageRelation.findMany({
      where: {
        OR: [{ fromId: id }, { toId: id }],
      },
      include: {
        from: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
        to: {
          select: { id: true, subject: true, statusId: true, typeId: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    return res.status(200).json(relations)
  } catch (error) {
    console.error('Error fetching relations:', error)
    return res.status(500).json({ error: 'Failed to fetch relations' })
  }
}

async function createRelation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const body = createRelationSchema.parse({ ...req.body, fromId: id })
    const relation = await prisma.workPackageRelation.create({
      data: {
        fromId: body.fromId,
        toId: body.toId,
        relationType: body.relationType,
      },
      include: {
        from: { select: { id: true, subject: true, statusId: true, typeId: true } },
        to: { select: { id: true, subject: true, statusId: true, typeId: true } },
      },
    })

    return res.status(201).json(relation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating relation:', error)
    return res.status(500).json({ error: 'Failed to create relation' })
  }
}
