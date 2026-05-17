import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity, makeSubjectId } from '@/lib/activity'

const CreateThreadSchema = z.object({
  subject: z.string().min(1).max(500),
  isSticky: z.boolean().optional().default(false),
  isLocked: z.boolean().optional().default(false),
  // First post content (required at creation)
  content: z.string().min(1),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId, forumId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }
  if (!forumId || typeof forumId !== 'string') {
    return res.status(400).json({ error: 'INVALID_FORUM_ID' })
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

  // Verify forum exists and belongs to project
  const forum = await prisma.forum.findFirst({
    where: { id: forumId, projectId },
  })
  if (!forum) {
    return res.status(404).json({ error: 'FORUM_NOT_FOUND' })
  }

  // GET /api/projects/[projectId]/forums/[forumId]/threads — list threads
  if (req.method === 'GET') {
    const { page = '1', pageSize = '20', sticky } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: Record<string, unknown> = {
      forumId,
      // Only show threads in non-locked forums (or include locked in listing)
    }

    // Optional sticky filter
    if (sticky === 'true') {
      where.isSticky = true
    }

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          _count: {
            select: { posts: true },
          },
        },
        orderBy: [
          { isPinned: 'desc' },
          { isSticky: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      prisma.forumThread.count({ where }),
    ])

    return res.json({
      threads,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    })
  }

  // POST /api/projects/[projectId]/forums/[forumId]/threads — create thread with first post
  if (req.method === 'POST') {
    const parsed = CreateThreadSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Create thread and first post in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const thread = await tx.forumThread.create({
        data: {
          forumId,
          subject: parsed.data.subject,
          authorId: session.user.id,
          isSticky: parsed.data.isSticky,
          isLocked: parsed.data.isLocked,
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          forum: { select: { id: true, name: true, projectId: true } },
        },
      })

      // Create the first post
      const post = await tx.forumPost.create({
        data: {
          threadId: thread.id,
          content: parsed.data.content,
          authorId: session.user.id,
        },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      return { thread, post }
    })

    // Emit activity for thread creation
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_thread',
      subjectId: makeSubjectId('forum_thread', result.thread.id),
      action: 'created',
      reference: {
        type: 'forum_thread',
        id: result.thread.id,
        subject: result.thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    // Emit activity for first post creation
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_post',
      subjectId: makeSubjectId('forum_post', result.post.id),
      action: 'created',
      reference: {
        type: 'forum_post',
        id: result.post.id,
        subject: result.thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(201).json({ thread: result.thread, post: result.post })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
