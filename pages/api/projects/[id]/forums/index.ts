import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const CreateForumSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().default(''),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { id: projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }

  // GET /api/projects/[id]/forums — delegate to /api/forums?projectId=xxx
  if (req.method === 'GET') {
    const forums = await prisma.forum.findMany({
      where: { projectId },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        _count: { select: { threads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(forums)
  }

  // POST /api/projects/[id]/forums — create forum under this project
  if (req.method === 'POST') {
    const parsed = CreateForumSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const forum = await prisma.forum.create({
      data: {
        projectId,
        name: parsed.data.name,
        description: parsed.data.description,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })
    return res.status(201).json(forum)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
