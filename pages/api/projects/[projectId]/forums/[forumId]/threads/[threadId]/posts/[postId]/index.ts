import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { isSystemAdmin } from '@/lib/auth'

const UpdatePostSchema = z.object({
  content: z.string().min(1),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId, forumId, threadId, postId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }
  if (!forumId || typeof forumId !== 'string') {
    return res.status(400).json({ error: 'INVALID_FORUM_ID' })
  }
  if (!threadId || typeof threadId !== 'string') {
    return res.status(400).json({ error: 'INVALID_THREAD_ID' })
  }
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'INVALID_POST_ID' })
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

  // Verify post exists and belongs to thread
  const existing = await prisma.forumPost.findFirst({
    where: { id: postId, threadId },
    include: {
      thread: { select: { subject: true, forum: { select: { projectId: true } } } },
    },
  })
  if (!existing) {
    return res.status(404).json({ error: 'POST_NOT_FOUND' })
  }

  // GET /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/[postId]
  if (req.method === 'GET') {
    return res.status(200).json(existing)
  }

  // PATCH /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/[postId] — update post
  if (req.method === 'PATCH') {
    const parsed = UpdatePostSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Only author or admin can update
    const isAdmin = await isSystemAdmin(session.user.id)
    if (existing.authorId !== session.user.id && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the author or an admin can update this post' })
    }

    const post = await prisma.forumPost.update({
      where: { id: postId },
      data: {
        content: parsed.data.content,
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
      action: 'updated',
      reference: {
        type: 'forum_post',
        id: post.id,
        subject: existing.thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json(post)
  }

  // DELETE /api/projects/[projectId]/forums/[forumId]/threads/[threadId]/posts/[postId]
  if (req.method === 'DELETE') {
    // Only author or admin can delete
    const isAdmin = await isSystemAdmin(session.user.id)
    if (existing.authorId !== session.user.id && !isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the author or an admin can delete this post' })
    }

    await prisma.forumPost.delete({ where: { id: postId } })

    // Emit activity
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'forum_post',
      subjectId: makeSubjectId('forum_post', existing.id),
      action: 'deleted',
      reference: {
        type: 'forum_post',
        id: existing.id,
        subject: existing.thread.subject,
        projectName: membership.project?.name,
        actorName: session.user.name ?? '',
      },
    })

    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
