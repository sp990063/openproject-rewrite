import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSystemAdmin } from '@/lib/auth'
import { emitActivity } from '@/lib/activity'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, slug } = req.query

  if (req.method === 'GET') {
    const news = await prisma.news.findUnique({
      where: { projectId_slug: { projectId: projectId as string, slug: slug as string } },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!news) return res.status(404).json({ error: 'News not found' })
    return res.json({ news })
  }

  if (req.method === 'PATCH') {
    const { title, summary, content } = req.body

    const existing = await prisma.news.findUnique({
      where: { projectId_slug: { projectId: projectId as string, slug: slug as string } },
    })
    if (!existing) return res.status(404).json({ error: 'News not found' })
    if (existing.authorId !== session.user.id) {
      return res.status(403).json({ error: 'Only the author can update this news item' })
    }

    const news = await prisma.news.update({
      where: { id: existing.id },
      data: {
        ...(title && { title }),
        ...(summary !== undefined && { summary }),
        ...(content && { content }),
      },
    })

    await emitActivity({
      projectId: projectId as string,
      userId: session.user.id,
      subjectType: 'news',
      subjectId: news.id,
      action: 'updated',
      reference: { type: 'news', id: news.id, subject: news.title },
    })

    return res.json({ news })
  }

  if (req.method === 'DELETE') {
    const existing = await prisma.news.findUnique({
      where: { projectId_slug: { projectId: projectId as string, slug: slug as string } },
    })
    if (!existing) return res.status(404).json({ error: 'News not found' })

    const isAdmin = await isSystemAdmin(session.user.id)
    if (existing.authorId !== session.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Only the author or an admin can delete this news item' })
    }

    await prisma.news.delete({ where: { id: existing.id } })

    await emitActivity({
      projectId: projectId as string,
      userId: session.user.id,
      subjectType: 'news',
      subjectId: existing.id,
      action: 'deleted',
      reference: { type: 'news', id: existing.id, subject: existing.title },
    })

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
