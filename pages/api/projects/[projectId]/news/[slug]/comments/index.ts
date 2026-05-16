import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity } from '@/lib/activity'


const CreateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId, slug } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' })
  }

  // GET /api/projects/[projectId]/news/[slug]/comments — list comments for a news item
  if (req.method === 'GET') {
    const news = await prisma.news.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true },
    })
    if (!news) {
      return res.status(404).json({ error: 'News not found' })
    }

    const comments = await prisma.newsComment.findMany({
      where: { newsId: news.id },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return res.json({ comments })
  }

  // POST /api/projects/[projectId]/news/[slug]/comments — add a comment
  if (req.method === 'POST') {
    const parsed = CreateCommentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const news = await prisma.news.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true },
    })
    if (!news) {
      return res.status(404).json({ error: 'News not found' })
    }

    const comment = await prisma.newsComment.create({
      data: {
        newsId: news.id,
        authorId: session.user.id,
        content: parsed.data.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'news',
      subjectId: news.id,
      action: 'commented',
      reference: { type: 'news', id: news.id, subject: slug },
    })

    return res.status(201).json({ comment })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
