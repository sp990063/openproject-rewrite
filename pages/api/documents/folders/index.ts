import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'

const querySchema = z.object({
  projectId: z.string().optional(),
  parentId: z.string().optional(),
})

const createFolderSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).max(255),
  parentId: z.string().optional(),
})

export default withRoute<z.infer<typeof createFolderSchema>, z.input<typeof querySchema>, unknown>(
  async ({ req, res, body, query, session }) => {
    if (req.method === 'GET') {
      // Same pattern as /api/documents GET: projectId query required,
      // assert membership.
      if (!query.projectId) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          'projectId query parameter is required'
        )
      }
      await assertProjectMembership(
        query.projectId,
        session.user.id,
        !!session.user.isSystemAdmin
      )

      const where: { projectId?: string; parentId?: string | null } = {
        projectId: query.projectId,
      }
      if (query.parentId !== undefined) {
        where.parentId = query.parentId === '' ? null : query.parentId
      }

      const folders = await prisma.documentFolder.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true } },
          children: { select: { id: true, name: true } },
          _count: { select: { documents: true, children: true } },
        },
        orderBy: { name: 'asc' },
      })

      return res.status(200).json({ success: true, data: folders })
    }

    if (req.method === 'POST') {
      await assertProjectMembership(
        body.projectId,
        session.user.id,
        !!session.user.isSystemAdmin
      )

      const folder = await prisma.documentFolder.create({
        data: {
          projectId: body.projectId,
          name: body.name,
          parentId: body.parentId ?? null,
        },
        include: {
          parent: { select: { id: true, name: true } },
        },
      })

      return res.status(201).json({ success: true, data: folder })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createFolderSchema,
    querySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
