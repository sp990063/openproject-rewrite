import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createForumSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  authorId: z.string().cuid(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getForums(req, res)
    case 'POST':
      return createForum(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getForums(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId } = req.query

    const where: { projectId?: string } = {}
    if (projectId) where.projectId = projectId as string

    const forums = await prisma.forum.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        _count: { select: { threads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json(forums)
  } catch (error) {
    console.error('Error fetching forums:', error)
    return res.status(500).json({ error: 'Failed to fetch forums' })
  }
}

async function createForum(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createForumSchema.parse(req.body)

    const forum = await prisma.forum.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        authorId: data.authorId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    return res.status(201).json(forum)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating forum:', error)
    return res.status(500).json({ error: 'Failed to create forum' })
  }
}
