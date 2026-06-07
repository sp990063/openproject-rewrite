import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().cuid().nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Folder ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getFolder(req, res, id)
    case 'PATCH':
      return updateFolder(req, res, id)
    case 'DELETE':
      return deleteFolder(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getFolder(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const folder = await prisma.documentFolder.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        documents: {
          select: { id: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { documents: true, children: true } },
      },
    })

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    return res.status(200).json(folder)
  } catch (error) {
    console.error('Error fetching folder:', error)
    return res.status(500).json({ error: 'Failed to fetch folder' })
  }
}

async function updateFolder(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateFolderSchema.parse(req.body)

    const existing = await prisma.documentFolder.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    // Prevent setting itself as parent
    if (data.parentId === id) {
      return res.status(400).json({ error: 'A folder cannot be its own parent' })
    }

    const folder = await prisma.documentFolder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
      include: {
        parent: { select: { id: true, name: true } },
      },
    })

    return res.status(200).json(folder)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating folder:', error)
    return res.status(500).json({ error: 'Failed to update folder' })
  }
}

async function deleteFolder(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const folder = await prisma.documentFolder.findUnique({
      where: { id },
      include: { _count: { select: { documents: true, children: true } } },
    })
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    if (folder._count.documents > 0) {
      return res.status(400).json({ error: 'Folder contains documents. Delete or move them first.' })
    }

    if (folder._count.children > 0) {
      return res.status(400).json({ error: 'Folder contains subfolders. Delete or move them first.' })
    }

    await prisma.documentFolder.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting folder:', error)
    return res.status(500).json({ error: 'Failed to delete folder' })
  }
}
