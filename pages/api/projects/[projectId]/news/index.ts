import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { emitActivity } from '@/lib/activity'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    const { page = '1', pageSize = '20' } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where: { projectId },
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.news.count({ where: { projectId } }),
    ])

    return res.json({
      news,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    })
  }

  if (req.method === 'POST') {
    const { title, summary, content } = req.body
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' })
    }

    const baseSlug = slugify(title)
    let slug = baseSlug
    let counter = 1

    // Ensure slug uniqueness within project
    while (await prisma.news.findUnique({ where: { projectId_slug: { projectId, slug } } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const news = await prisma.news.create({
      data: {
        projectId,
        authorId: session.user.id,
        title,
        slug,
        summary: summary ?? null,
        content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'news',
      subjectId: news.id,
      action: 'created',
      reference: { type: 'news', id: news.id, subject: news.title },
    })

    return res.status(201).json({ news })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
