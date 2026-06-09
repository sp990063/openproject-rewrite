import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'

const querySchema = z.object({
  projectId: z.string().optional(),
  folderId: z.string().optional(),
})

const createDocumentSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().optional().default(''),
  folderId: z.string().optional(),
  authorId: z.string(),
})

export default withRoute<z.infer<typeof createDocumentSchema>, z.input<typeof querySchema>, unknown>(
  async ({ req, res, body, query, session }) => {
    if (req.method === 'GET') {
      // GET /api/documents?projectId=...&folderId=...
      // RBAC: filter by projectId, then assert membership.
      // If projectId is provided in the query, require membership; if not,
      // we'll only return documents in projects the user is a member of
      // (which requires an additional query — keep it simple for now:
      // require projectId on the way in).
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

      const where: { projectId?: string; folderId?: string | null } = {
        projectId: query.projectId,
      }
      if (query.folderId !== undefined) {
        where.folderId = query.folderId === '' ? null : query.folderId
      }

      const documents = await prisma.document.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true, identifier: true } },
          folder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return res.status(200).json({ success: true, data: documents })
    }

    if (req.method === 'POST') {
      // POST /api/documents — body carries projectId, assert membership
      // before creating the document. This is the only chance to gate
      // access because the URL is just /api/documents.
      await assertProjectMembership(
        body.projectId,
        session.user.id,
        !!session.user.isSystemAdmin
      )

      const document = await prisma.document.create({
        data: {
          projectId: body.projectId,
          title: body.title,
          description: body.description,
          folderId: body.folderId ?? null,
          authorId: body.authorId,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          project: { select: { id: true, name: true, identifier: true } },
          folder: { select: { id: true, name: true } },
        },
      })

      return res.status(201).json({ success: true, data: document })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createDocumentSchema,
    querySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
