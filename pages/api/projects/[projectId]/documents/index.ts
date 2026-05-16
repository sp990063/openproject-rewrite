
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity } from '@/lib/activity'

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  folderId: z.string().optional().nullable(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
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

  // GET /api/projects/[projectId]/documents — list documents (exclude deleted)
  if (req.method === 'GET') {
    const { folderId } = req.query

    const where: Record<string, unknown> = {
      projectId,
      deletedAt: null, // exclude soft-deleted
    }

    // Optional folderId filter
    if (folderId !== undefined) {
      if (folderId === 'null' || folderId === '') {
        where.folderId = null
      } else if (typeof folderId === 'string') {
        where.folderId = folderId
      }
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return res.status(200).json(documents)
  }

  // POST /api/projects/[projectId]/documents — create document metadata
  if (req.method === 'POST') {
    const parsed = CreateDocumentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Validate folderId if provided
    if (parsed.data.folderId) {
      const folder = await prisma.documentFolder.findUnique({
        where: { id: parsed.data.folderId },
      })
      if (!folder || folder.projectId !== projectId) {
        return res.status(400).json({ error: 'INVALID_FOLDER_ID' })
      }
    }

    const document = await prisma.document.create({
      data: {
        projectId,
        title: parsed.data.title,
        description: parsed.data.description,
        folderId: parsed.data.folderId ?? null,
        authorId: session.user.id,
        version: 1,
        fileName: '',
        fileSize: 0,
        fileType: '',
        fileUrl: '',
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'document',
      subjectId: document.id,
      action: 'created',
      reference: { type: 'document', id: document.id, subject: document.title },
    })

    return res.status(201).json(document)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
