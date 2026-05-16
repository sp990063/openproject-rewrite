import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { emitActivity } from '@/lib/activity'

const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  folderId: z.string().nullable().optional(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return res.status(401).json({ error: 'UNAUTHORIZED' })
  }

  const { projectId, id } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'INVALID_PROJECT_ID' })
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'INVALID_DOCUMENT_ID' })
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

  // GET /api/projects/[projectId]/documents/[id]
  if (req.method === 'GET') {
    const document = await prisma.document.findFirst({
      where: {
        id,
        projectId,
        deletedAt: null, // exclude soft-deleted
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
    })

    if (!document) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    return res.status(200).json(document)
  }

  // PATCH /api/projects/[projectId]/documents/[id] — update title/description/folder
  if (req.method === 'PATCH') {
    const parsed = UpdateDocumentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const document = await prisma.document.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!document) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    // Validate folderId if provided
    if (parsed.data.folderId !== undefined && parsed.data.folderId !== null) {
      const folder = await prisma.documentFolder.findUnique({
        where: { id: parsed.data.folderId },
      })
      if (!folder || folder.projectId !== projectId) {
        return res.status(400).json({ error: 'INVALID_FOLDER_ID' })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.folderId !== undefined) updateData.folderId = parsed.data.folderId

    const updated = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
      },
    })

    return res.status(200).json(updated)
  }

  // DELETE /api/projects/[projectId]/documents/[id] — soft delete
  if (req.method === 'DELETE') {
    const document = await prisma.document.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!document) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    await prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'document',
      subjectId: id,
      action: 'deleted',
      reference: { type: 'document', id, subject: document.title },
    })

    return res.status(200).json({ deletedAt: new Date() })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
