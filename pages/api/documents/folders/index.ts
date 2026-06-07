import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const createFolderSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(255),
  parentId: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return getFolders(req, res)
    case 'POST':
      return createFolder(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getFolders(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId, parentId } = req.query

    const where: { projectId?: string; parentId?: string | null } = {}
    if (projectId) where.projectId = projectId as string
    if (parentId !== undefined) where.parentId = parentId === '' ? null : (parentId as string)

    const folders = await prisma.documentFolder.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { documents: true, children: true } },
      },
      orderBy: { name: 'asc' },
    })

    return res.status(200).json(folders)
  } catch (error) {
    console.error('Error fetching document folders:', error)
    return res.status(500).json({ error: 'Failed to fetch document folders' })
  }
}

async function createFolder(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createFolderSchema.parse(req.body)

    const folder = await prisma.documentFolder.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        parentId: data.parentId ?? null,
      },
      include: {
        parent: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json(folder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating document folder:', error)
    return res.status(500).json({ error: 'Failed to create document folder' })
  }
}
