import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity, makeSubjectId } from '@/lib/activity'

const CreatePostSchema = z.object({
  content: z.string().min(1),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId, forumId, threadId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }
  if (!forumId || typeof forumId !== 'string') {
    return res.status(400).json({ error: 'INVALID_FORUM_ID' })
  }
  if (!threadId || typeof threadId !== 'string') {
    return res.status(400).json({ error: 'INVALID_THREAD_ID' })
  }

  // Check project membership
  const membership = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
    include: { project: { select: { name: true } } },
  })
  if (!membership) {
    return res.status(403).json({ error: 'FORBIDDEN' })
  }

  // Verify thread exists and belongs to forum
  const thread = await prisma.forumThread.findFirst({
    where: { id: threadId, forumId },
    include: { forum: { select: { projectId: true } } },
  })
  if (!thread) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' })
  }

  // GET /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts — list posts
  if (req.method === 'GET') {
    const { page = '1', pageSize = '20' } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { threadId },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      prisma.forumPost.count({ where: { threadId } }),
    ])

    return res.json({
      posts,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    })
  }

  // POST /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts — create post
  if (req.method === 'POST') {
    const parsed = CreatePostSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Cannot post to locked threads
    if (thread.isLocked) {
      return res.status(403).json({ error: 'THREAD_LOCKED', message: 'Cannot post to a locked thread' })
    }

    const post = await prisma.forumPost.create({
      data: {
        threadId,
        content: parsed.data.content,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_post',
      subjectId: makeSubjectId('forum_post', post.id),
      action: 'created',
      reference: {
        type: 'forum_post',
        id: post.id,
        subject: thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(201).json({ post })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
