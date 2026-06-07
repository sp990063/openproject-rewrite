import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const createPostSchema = z.object({
  threadId: z.string(),
  content: z.string().min(1),
  authorId: z.string(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return getPosts(req, res)
    case 'POST':
      return createPost(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getPosts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { threadId } = req.query

    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' })
    }

    const posts = await prisma.forumPost.findMany({
      where: { threadId: threadId as string },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        thread: { select: { id: true, subject: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return res.status(200).json(posts)
  } catch (error) {
    console.error('Error fetching posts:', error)
    return res.status(500).json({ error: 'Failed to fetch posts' })
  }
}

async function createPost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { threadId } = req.query
    if (!threadId) {
      return res.status(400).json({ error: 'threadId is required' })
    }
    const data = createPostSchema.parse({ ...req.body, threadId })

    // Verify thread exists and is not locked
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId as string } })
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' })
    }
    if (thread.isLocked) {
      return res.status(403).json({ error: 'Cannot post to a locked thread' })
    }

    const post = await prisma.forumPost.create({
      data: {
        threadId: data.threadId,
        content: data.content,
        authorId: data.authorId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        thread: { select: { id: true, subject: true } },
      },
    })

    return res.status(201).json(post)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating post:', error)
    return res.status(500).json({ error: 'Failed to create post' })
  }
}
