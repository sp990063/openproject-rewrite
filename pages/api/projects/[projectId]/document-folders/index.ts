
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().optional().nullable(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
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

  // GET /api/projects/[projectId]/document-folders — list folders
  if (req.method === 'GET') {
    const folders = await prisma.documentFolder.findMany({
      where: { projectId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { documents: true, children: true } },
      },
      orderBy: { name: 'asc' },
    })

    return res.status(200).json(folders)
  }

  // POST /api/projects/[projectId]/document-folders — create folder
  if (req.method === 'POST') {
    const parsed = CreateFolderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Validate parentId if provided
    if (parsed.data.parentId) {
      const parent = await prisma.documentFolder.findUnique({
        where: { id: parsed.data.parentId },
      })
      if (!parent || parent.projectId !== projectId) {
        return res.status(400).json({ error: 'INVALID_PARENT_ID' })
      }
    }

    const folder = await prisma.documentFolder.create({
      data: {
        projectId,
        name: parsed.data.name,
        parentId: parsed.data.parentId ?? null,
      },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json(folder)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
