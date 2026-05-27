import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createThreadSchema = z.object({
  forumId: z.string(),
  subject: z.string().min(1).max(500),
  authorId: z.string(),
  isSticky: z.boolean().optional().default(false),
  isLocked: z.boolean().optional().default(false),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getThreads(req, res)
    case 'POST':
      return createThread(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getThreads(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Accept forumId as query param OR extract from /forums/[id]/threads route
    let { forumId } = req.query
    if (!forumId && req.query.id) {
      forumId = req.query.id
    }

    if (!forumId) {
      return res.status(400).json({ error: 'forumId is required' })
    }

    const threads = await prisma.forumThread.findMany({
      where: { forumId: forumId as string },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        forum: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
      orderBy: [{ isSticky: 'desc' }, { createdAt: 'desc' }],
    })

    return res.status(200).json(threads)
  } catch (error) {
    console.error('Error fetching threads:', error)
    return res.status(500).json({ error: 'Failed to fetch threads' })
  }
}

async function createThread(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createThreadSchema.parse(req.body)

    // Verify forum exists
    const forum = await prisma.forum.findUnique({ where: { id: data.forumId } })
    if (!forum) {
      return res.status(404).json({ error: 'Forum not found' })
    }

    const thread = await prisma.forumThread.create({
      data: {
        forumId: data.forumId,
        subject: data.subject,
        authorId: data.authorId,
        isSticky: data.isSticky,
        isLocked: data.isLocked,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        forum: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json(thread)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating thread:', error)
    return res.status(500).json({ error: 'Failed to create thread' })
  }
}
