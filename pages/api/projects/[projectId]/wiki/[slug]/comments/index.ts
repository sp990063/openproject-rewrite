
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity, makeSubjectId } from '@/lib/activity'

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

  // GET /api/projects/[projectId]/wiki/[slug]/comments — list comments for a wiki page
  if (req.method === 'GET') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true, title: true },
    })
    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    // Wiki pages use ActivityComment via the Activity model
    const activities = await prisma.activity.findMany({
      where: {
        projectId,
        subjectType: 'wiki_page',
        subjectId: makeSubjectId('wiki_page', page.id),
        action: 'commented',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return res.json({ comments: activities })
  }

  // POST /api/projects/[projectId]/wiki/[slug]/comments — add a comment to a wiki page
  if (req.method === 'POST') {
    const parsed = CreateCommentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true, title: true },
    })
    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    // Create an activity with the comment
    const activity = await prisma.activity.create({
      data: {
        projectId,
        userId: session.user.id,
        subjectType: 'wiki_page',
        subjectId: makeSubjectId('wiki_page', page.id),
        action: 'commented',
        reference: {
          type: 'WikiPage',
          id: page.id,
          subject: page.title,
          projectName: '',
          actorName: session.user.name ?? '',
        },
      },
    })

    // Create the comment attached to this activity
    const comment = await prisma.activityComment.create({
      data: {
        activityId: activity.id,
        userId: session.user.id,
        content: parsed.data.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    })

    return res.status(201).json({ comment })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
