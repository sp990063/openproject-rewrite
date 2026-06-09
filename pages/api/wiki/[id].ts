import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/markdown'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertWikiPageProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

const updateWikiPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().nullish().optional(),
})

export default withRoute<z.infer<typeof updateWikiPageSchema>, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, body, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.1b: 403 if user is not a member of
    // the project that owns this wiki page; 404 if page does not exist).
    await assertWikiPageProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'GET') {
      const wikiPage = await prisma.wikiPage.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          parent: { select: { id: true, title: true, slug: true } },
          children: { select: { id: true, title: true, slug: true } },
          project: { select: { id: true, name: true, identifier: true } },
        },
      })
      return res.status(200).json({ success: true, data: wikiPage })
    }

    if (req.method === 'PATCH') {
      const currentPage = await prisma.wikiPage.findUnique({ where: { id } })
      if (!currentPage) {
        throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
      }

      let newSlug = currentPage.slug
      if (body.title) {
        newSlug = generateSlug(body.title)
        const existing = await prisma.wikiPage.findUnique({
          where: { projectId_slug: { projectId: currentPage.projectId, slug: newSlug } },
        })
        if (existing && existing.id !== id) {
          throw new ApiError(
            409,
            'WIKI_PAGE_EXISTS',
            'A wiki page with this title already exists in the project'
          )
        }
      }

      const newVersion = currentPage.version + 1

      const wikiPage = await prisma.$transaction(async (tx) => {
        const updated = await tx.wikiPage.update({
          where: { id },
          data: {
            ...(body.title && { title: body.title, slug: newSlug }),
            ...(body.content !== undefined && { content: body.content }),
            ...(body.parentId !== undefined && { parentId: body.parentId === null ? null : body.parentId }),
            version: newVersion,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            parent: { select: { id: true, title: true, slug: true } },
            children: { select: { id: true, title: true, slug: true } },
            project: { select: { id: true, name: true, identifier: true } },
          },
        })

        await tx.wikiPageVersion.create({
          data: {
            wikiPageId: id,
            content: body.content ?? currentPage.content,
            authorId: currentPage.authorId,
            version: newVersion,
          },
        })

        return updated
      })

      return res.status(200).json({ success: true, data: wikiPage })
    }

    if (req.method === 'DELETE') {
      const page = await prisma.wikiPage.findUnique({
        where: { id },
        include: { _count: { select: { children: true } } },
      })
      if (!page) {
        throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
      }
      if (page._count.children > 0) {
        throw new ApiError(
          400,
          'WIKI_PAGE_HAS_CHILDREN',
          'Cannot delete a wiki page that has child pages. Delete or move the children first.'
        )
      }

      await prisma.wikiPage.delete({ where: { id } })
      return res.status(204).end()
    }

    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateWikiPageSchema,
    paramsSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
