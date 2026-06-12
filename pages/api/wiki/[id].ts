import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateSlug, uniqueSlug } from '@/lib/slug'
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
        const baseSlug = generateSlug(body.title)
        // Auto-uniquify within the project, excluding the current page.
        const existingSlugs = (
          await prisma.wikiPage.findMany({
            where: { projectId: currentPage.projectId, NOT: { id } },
            select: { slug: true },
          })
        ).map((p) => p.slug)
        newSlug = uniqueSlug(baseSlug, existingSlugs)
      }

      // WIKI-7: parentId cycle check — prevent infinite hierarchy loops.
      if (body.parentId !== undefined && body.parentId !== null) {
        if (body.parentId === id) {
          throw new ApiError(
            400,
            'WIKI_PARENT_CYCLE',
            'A wiki page cannot be its own parent'
          )
        }
        // Walk up the ancestor chain of the proposed parent and reject
        // if we encounter the current page (would form a cycle).
        let cursor: string | null = body.parentId
        const seen = new Set<string>()
        while (cursor) {
          if (seen.has(cursor)) break // defensive: also stop on existing cycles
          seen.add(cursor)
          if (cursor === id) {
            throw new ApiError(
              400,
              'WIKI_PARENT_CYCLE',
              'Cannot set parent: would create a cycle in the wiki page hierarchy'
            )
          }
          const ancestor: { parentId: string | null } | null =
            await prisma.wikiPage.findUnique({
              where: { id: cursor },
              select: { parentId: true },
            })
          cursor = ancestor?.parentId ?? null
        }
      }

      // WIKI-9: only increment version + create a version row when content
      // actually changes. Title/parentId edits should NOT bump the version.
      const isContentUpdate =
        body.content !== undefined && body.content !== currentPage.content
      const newVersion = isContentUpdate
        ? currentPage.version + 1
        : currentPage.version

      const wikiPage = await prisma.$transaction(async (tx) => {
        const updated = await tx.wikiPage.update({
          where: { id },
          data: {
            ...(body.title && { title: body.title, slug: newSlug }),
            ...(body.content !== undefined && { content: body.content }),
            ...(body.parentId !== undefined && { parentId: body.parentId === null ? null : body.parentId }),
            ...(isContentUpdate && { version: newVersion }),
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            parent: { select: { id: true, title: true, slug: true } },
            children: { select: { id: true, title: true, slug: true } },
            project: { select: { id: true, name: true, identifier: true } },
          },
        })

        if (isContentUpdate) {
          // WIKI-10: authorId is the editor, not the original page author.
          await tx.wikiPageVersion.create({
            data: {
              wikiPageId: id,
              content: body.content!,
              authorId: session.user.id,
              version: newVersion,
            },
          })
        }

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