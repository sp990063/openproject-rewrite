
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
    return res.status(400).json({ error: 'INVALID_FOLDER_ID' })
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

  // GET /api/projects/[projectId]/document-folders/[id]
  if (req.method === 'GET') {
    const folder = await prisma.documentFolder.findFirst({
      where: { id, projectId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        documents: { select: { id: true, title: true } },
        _count: { select: { documents: true, children: true } },
      },
    })

    if (!folder) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    return res.status(200).json(folder)
  }

  // PATCH /api/projects/[projectId]/document-folders/[id] — rename folder
  if (req.method === 'PATCH') {
    const parsed = UpdateFolderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const folder = await prisma.documentFolder.findFirst({
      where: { id, projectId },
    })
    if (!folder) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    const updated = await prisma.documentFolder.update({
      where: { id },
      data: {
        name: parsed.data.name,
      },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
      },
    })

    return res.status(200).json(updated)
  }

  // DELETE /api/projects/[projectId]/document-folders/[id] — must be empty
  if (req.method === 'DELETE') {
    const folder = await prisma.documentFolder.findFirst({
      where: { id, projectId },
      include: {
        _count: { select: { documents: true, children: true } },
      },
    })

    if (!folder) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }

    // Check if folder has documents or subfolders
    if (folder._count.documents > 0 || folder._count.children > 0) {
      return res.status(400).json({
        error: 'FOLDER_NOT_EMPTY',
        message: 'Folder must be empty before deletion',
        documentCount: folder._count.documents,
        subfolderCount: folder._count.children,
      })
    }

    await prisma.documentFolder.delete({ where: { id } })

    return res.status(200).json({ deleted: true })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
}
