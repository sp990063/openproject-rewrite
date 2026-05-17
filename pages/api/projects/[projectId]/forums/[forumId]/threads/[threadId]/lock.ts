import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'


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
  })
  if (!membership) {
    return res.status(403).json({ error: 'FORBIDDEN' })
  }

  // Admin only for lock/unlock
  const isAdmin = await isSystemAdmin(session.user.id)
  if (!isAdmin) {
    return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Only admins can lock/unlock threads' })
  }

  // Verify thread exists and belongs to forum
  const existing = await prisma.forumThread.findFirst({
    where: { id: threadId, forumId },
  })
  if (!existing) {
    return res.status(404).json({ error: 'THREAD_NOT_FOUND' })
  }

  // POST — toggle lock status
  if (req.method === 'POST') {
    const thread = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isLocked: !existing.isLocked },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        forum: { select: { id: true, name: true, projectId: true } },
      },
    })

    return res.status(200).json({ thread, isLocked: thread.isLocked })
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
