import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertDocumentProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  folderId: z.string().cuid().nullable().optional(),
})

export default withRoute<z.infer<typeof updateDocumentSchema>, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, body, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.2b): resolve documentId -> projectId
    // -> membership check. System admins bypass.
    await assertDocumentProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'GET') {
      const document = await prisma.document.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true, identifier: true } },
          folder: { select: { id: true, name: true, parentId: true } },
        },
      })
      if (!document) {
        throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document not found')
      }
      return res.status(200).json({ success: true, data: document })
    }

    if (req.method === 'PATCH') {
      const document = await prisma.document.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.folderId !== undefined && { folderId: body.folderId }),
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true, identifier: true } },
          folder: { select: { id: true, name: true } },
        },
      })
      return res.status(200).json({ success: true, data: document })
    }

    if (req.method === 'DELETE') {
      await prisma.document.delete({ where: { id } })
      return res.status(204).end()
    }

    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateDocumentSchema,
    paramsSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
