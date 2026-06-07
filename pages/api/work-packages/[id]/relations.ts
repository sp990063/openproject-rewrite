import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { emitActivity } from '@/lib/activity'

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

  // Auth gate (Phase 7 sprint A1 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
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
    case 'DELETE':
      return deleteRelation(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
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

    // Emit unified activity for both work packages involved in the relation
    // Get projectId from the 'from' work package
    const fromWp = await prisma.workPackage.findUnique({
      where: { id: body.fromId },
      select: { projectId: true, authorId: true },
    })

    if (fromWp) {
      await emitActivity({
        projectId: fromWp.projectId,
        userId: fromWp.authorId,
        subjectType: 'relation',
        subjectId: relation.id,
        action: 'created',
        details: { relationType: body.relationType, fromId: body.fromId, toId: body.toId },
        reference: {
          type: 'work_package',
          id: body.fromId,
          subject: relation.from.subject,
        },
      })
    }

    return res.status(201).json(relation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating relation:', error)
    return res.status(500).json({ error: 'Failed to create relation' })
  }
}

async function deleteRelation(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const { relationId } = req.query

    if (!relationId || typeof relationId !== 'string') {
      return res.status(400).json({ error: 'Relation ID is required' })
    }

    // Get relation for activity reference before deletion
    const relation = await prisma.workPackageRelation.findUnique({
      where: { id: relationId },
      include: {
        from: { select: { id: true, subject: true, projectId: true, authorId: true } },
        to: { select: { id: true, subject: true } },
      },
    })

    if (!relation) {
      return res.status(404).json({ error: 'Relation not found' })
    }

    await prisma.workPackageRelation.delete({
      where: { id: relationId },
    })

    // Emit unified activity
    await emitActivity({
      projectId: relation.from.projectId,
      userId: relation.from.authorId,
      subjectType: 'relation',
      subjectId: relationId,
      action: 'deleted',
      details: { relationType: relation.relationType, fromId: relation.fromId, toId: relation.toId },
      reference: {
        type: 'work_package',
        id: relation.fromId,
        subject: relation.from.subject,
      },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting relation:', error)
    return res.status(500).json({ error: 'Failed to delete relation' })
  }
}
