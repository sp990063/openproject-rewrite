import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity, makeSubjectId } from '@/lib/activity'

const UpdateThreadSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  isSticky: z.boolean().optional(),
  isLocked: z.boolean().optional(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
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

  // Verify thread exists and belongs to forum/project
  const existing = await prisma.forumThread.findFirst({
    where: { id: threadId, forumId },
    include: { forum: { select: { projectId: true } } },
  })
  if (!existing) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' })
  }

  // GET /api/projects/[projectId]/forums/[forumId]/threads/[threadId] — get single thread
  if (req.method === 'GET') {
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        forum: { select: { id: true, name: true, projectId: true } },
        posts: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { posts: true },
        },
      },
    })

    if (!thread) {
      return res.status(404).json({ error: 'THREAD_NOT_FOUND' })
    }

    return res.status(200).json(thread)
  }

  // PATCH /api/projects/[projectId]/forums/[forumId]/threads/[threadId] — update thread
  if (req.method === 'PATCH') {
    const parsed = UpdateThreadSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const thread = await prisma.forumThread.update({
      where: { id: threadId },
      data: {
        ...(parsed.data.subject !== undefined && { subject: parsed.data.subject }),
        ...(parsed.data.isSticky !== undefined && { isSticky: parsed.data.isSticky }),
        ...(parsed.data.isLocked !== undefined && { isLocked: parsed.data.isLocked }),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        forum: { select: { id: true, name: true, projectId: true } },
      },
    })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_thread',
      subjectId: makeSubjectId('forum_thread', thread.id),
      action: 'updated',
      reference: {
        type: 'forum_thread',
        id: thread.id,
        subject: thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json(thread)
  }

  // DELETE /api/projects/[projectId]/forums/[forumId]/threads/[threadId] — delete thread
  if (req.method === 'DELETE') {
    await prisma.forumThread.delete({ where: { id: threadId } })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_thread',
      subjectId: makeSubjectId('forum_thread', existing.id),
      action: 'deleted',
      reference: {
        type: 'forum_thread',
        id: existing.id,
        subject: existing.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
