import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateForumSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Forum ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getForum(req, res, id)
    case 'PATCH':
      return updateForum(req, res, id)
    case 'DELETE':
      return deleteForum(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getForum(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const forum = await prisma.forum.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        threads: {
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { posts: true } },
          },
          orderBy: [{ isSticky: 'desc' }, { createdAt: 'desc' }],
        },
        _count: { select: { threads: true } },
      },
    })

    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' })
    }

    return res.status(200).json(forum)
  } catch (error) {
    console.error('Error fetching forum:', error)
    return res.status(500).json({ error: 'Failed to fetch forum' })
  }
}

async function updateForum(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateForumSchema.parse(req.body)

    const existing = await prisma.forum.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Forum not found' })
    }

    const forum = await prisma.forum.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    return res.status(200).json(forum)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating forum:', error)
    return res.status(500).json({ error: 'Failed to update forum' })
  }
}

async function deleteForum(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const forum = await prisma.forum.findUnique({ where: { id } })
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' })
    }

    await prisma.forum.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting forum:', error)
    return res.status(500).json({ error: 'Failed to delete forum' })
  }
}
