import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateThreadSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  isSticky: z.boolean().optional(),
  isLocked: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const threadId = query.threadId as string

  if (!threadId) {
    return res.status(400).json({ error: 'Thread ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getThread(req, res, threadId)
    case 'PATCH':
      return updateThread(req, res, threadId)
    case 'DELETE':
      return deleteThread(req, res, threadId)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getThread(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        forum: {
          select: { id: true, name: true, project: { select: { id: true, name: true, identifier: true } } },
        },
        posts: {
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { posts: true } },
      },
    })

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    return res.status(200).json(thread)
  } catch (error) {
    console.error('Error fetching thread:', error)
    return res.status(500).json({ error: 'Failed to fetch thread' })
  }
}

async function updateThread(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateThreadSchema.parse(req.body)

    const existing = await prisma.forumThread.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    const thread = await prisma.forumThread.update({
      where: { id },
      data: {
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.isSticky !== undefined && { isSticky: data.isSticky }),
        ...(data.isLocked !== undefined && { isLocked: data.isLocked }),
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        forum: { select: { id: true, name: true } },
      },
    })

    return res.status(200).json(thread)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating thread:', error)
    return res.status(500).json({ error: 'Failed to update thread' })
  }
}

async function deleteThread(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const thread = await prisma.forumThread.findUnique({ where: { id } })
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    await prisma.forumThread.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting thread:', error)
    return res.status(500).json({ error: 'Failed to delete thread' })
  }
}
