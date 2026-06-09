import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertFolderProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().cuid().nullable().optional(),
})

export default withRoute<z.infer<typeof updateFolderSchema>, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, body, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.2b).
    await assertFolderProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'GET') {
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
        throw new ApiError(404, 'FOLDER_NOT_FOUND', 'Folder not found')
      }
      return res.status(200).json({ success: true, data: folder })
    }

    if (req.method === 'PATCH') {
      // Prevent setting itself as parent (logic preserved from old handler).
      if (body.parentId === id) {
        throw new ApiError(
          400,
          'FOLDER_CANNOT_BE_OWN_PARENT',
          'A folder cannot be its own parent'
        )
      }

      const folder = await prisma.documentFolder.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.parentId !== undefined && { parentId: body.parentId }),
        },
        include: {
          parent: { select: { id: true, name: true } },
        },
      })
      return res.status(200).json({ success: true, data: folder })
    }

    if (req.method === 'DELETE') {
      const folder = await prisma.documentFolder.findUnique({
        where: { id },
        include: { _count: { select: { documents: true, children: true } } },
      })
      if (!folder) {
        throw new ApiError(404, 'FOLDER_NOT_FOUND', 'Folder not found')
      }
      if (folder._count.documents > 0) {
        throw new ApiError(
          400,
          'FOLDER_NOT_EMPTY',
          'Folder contains documents. Delete or move them first.'
        )
      }
      if (folder._count.children > 0) {
        throw new ApiError(
          400,
          'FOLDER_NOT_EMPTY',
          'Folder contains subfolders. Delete or move them first.'
        )
      }

      await prisma.documentFolder.delete({ where: { id } })
      return res.status(204).end()
    }

    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateFolderSchema,
    paramsSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
