import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity, makeSubjectId } from '@/lib/activity'

const CreateForumSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

const UpdateForumSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
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

  // GET /api/projects/[projectId]/forums/[forumId] — get single forum
  if (req.method === 'GET') {
    const forum = await prisma.forum.findFirst({
      where: {
        id: forumId,
        projectId,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: {
          select: { threads: true },
        },
      },
    })

    if (!forum) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    return res.status(200).json(forum)
  }

  // PATCH /api/projects/[projectId]/forums/[forumId] — update forum
  if (req.method === 'PATCH') {
    const parsed = UpdateForumSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const existing = await prisma.forum.findFirst({
      where: { id: forumId, projectId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    const forum = await prisma.forum.update({
      where: { id: forumId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum',
      subjectId: makeSubjectId('forum', forum.id),
      action: 'updated',
      reference: {
        type: 'forum',
        id: forum.id,
        subject: forum.name,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json(forum)
  }

  // DELETE /api/projects/[projectId]/forums/[forumId] — delete forum
  if (req.method === 'DELETE') {
    const existing = await prisma.forum.findFirst({
      where: { id: forumId, projectId },
      include: { _count: { select: { threads: true } } },
    })
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    // Prevent deletion if forum has threads (cascade would delete them)
    if (existing._count.threads > 0) {
      return res.status(409).json({ error: 'FORUM_HAS_THREADS', message: 'Cannot delete a forum that contains threads' })
    }

    await prisma.forum.delete({ where: { id: forumId } })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum',
      subjectId: makeSubjectId('forum', existing.id),
      action: 'deleted',
      reference: {
        type: 'forum',
        id: existing.id,
        subject: existing.name,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
