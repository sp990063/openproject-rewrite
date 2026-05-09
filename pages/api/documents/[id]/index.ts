import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  folderId: z.string().cuid().nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Document ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getDocument(req, res, id)
    case 'PATCH':
      return updateDocument(req, res, id)
    case 'DELETE':
      return deleteDocument(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getDocument(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        folder: { select: { id: true, name: true, parentId: true } },
      },
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    return res.status(200).json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return res.status(500).json({ error: 'Failed to fetch document' })
  }
}

async function updateDocument(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateDocumentSchema.parse(req.body)

    const existing = await prisma.document.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.folderId !== undefined && { folderId: data.folderId }),
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        folder: { select: { id: true, name: true } },
      },
    })

    return res.status(200).json(document)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating document:', error)
    return res.status(500).json({ error: 'Failed to update document' })
  }
}

async function deleteDocument(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const document = await prisma.document.findUnique({ where: { id } })
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    await prisma.document.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting document:', error)
    return res.status(500).json({ error: 'Failed to delete document' })
  }
}
