import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createDocumentSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  folderId: z.string().optional(),
  authorId: z.string(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getDocuments(req, res)
    case 'POST':
      return createDocument(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getDocuments(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId, folderId } = req.query

    const where: { projectId?: string; folderId?: string | null } = {}
    if (projectId) where.projectId = projectId as string
    if (folderId !== undefined) where.folderId = folderId === '' ? null : folderId as string

    const documents = await prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return res.status(500).json({ error: 'Failed to fetch documents' })
  }
}

async function createDocument(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createDocumentSchema.parse(req.body)

    const document = await prisma.document.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        folderId: data.folderId ?? null,
        authorId: data.authorId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        project: { select: { id: true, name: true, identifier: true } },
        folder: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json(document)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating document:', error)
    return res.status(500).json({ error: 'Failed to create document' })
  }
}
