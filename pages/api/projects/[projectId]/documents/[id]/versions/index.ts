
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity } from '@/lib/activity'

const CreateVersionSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative().optional().default(0),
  fileType: z.string().optional().default(''),
  fileUrl: z.string().optional().default(''),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId, id } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid document id' })
  }

  // GET /api/projects/[projectId]/documents/[id]/versions — list versions
  if (req.method === 'GET') {
    const document = await prisma.document.findFirst({
      where: { id, projectId, deletedAt: null },
    })
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { version: 'desc' },
    })

    return res.json({ versions })
  }

  // POST /api/projects/[projectId]/documents/[id]/versions — create new version
  if (req.method === 'POST') {
    const parsed = CreateVersionSchema.safeParse(req.body)
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
      return res.status(404).json({ error: 'Document not found' })
    }

    // Get the latest version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId: id },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (latestVersion?.version ?? document.version) + 1

    const version = await prisma.documentVersion.create({
      data: {
        documentId: id,
        version: nextVersion,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        fileType: parsed.data.fileType,
        fileUrl: parsed.data.fileUrl,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'document',
      subjectId: id,
      action: 'version_created',
      reference: { type: 'document', id, subject: document.title, version: nextVersion },
    })

    return res.status(201).json({ version })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
