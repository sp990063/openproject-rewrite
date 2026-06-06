// pages/api/projects/[projectId]/wiki/[slug].ts
//
// Wiki detail: get, update, delete a single wiki page by slug
// (spec §2.4, §2.6)
//
//   GET    /api/projects/[projectId]/wiki/[slug]   — get page + sanitized HTML
//   PATCH  /api/projects/[projectId]/wiki/[slug]   — update content (creates new version)
//   DELETE /api/projects/[projectId]/wiki/[slug]   — soft? no, hard delete (cascade versions)
//
// GET response includes `html` field (sanitized Markdown) so the client
// doesn't have to ship a Markdown parser bundle. PATCH increments
// `version` and creates a new WikiPageVersion on the same transaction.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { requireProjectPermission } from '@/lib/permissions/check'
import { renderMarkdown } from '@/lib/markdown'

const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().nullable().optional(),
})

const PAGE_INCLUDE = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  parent: { select: { id: true, title: true, slug: true } },
  children: { select: { id: true, title: true, slug: true } },
  _count: { select: { versions: true } },
} as const

export default withRoute<
  z.infer<typeof updatePageSchema>,
  unknown,
  { projectId: string; slug: string }
>(
  async ({ req, res, session, body, params }) => {
    const { projectId, slug } = params
    if (!projectId || !slug) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID and slug are required')
    }

    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      include: PAGE_INCLUDE,
    })
    if (!page) {
      throw new ApiError(404, 'PAGE_NOT_FOUND', 'Wiki page not found')
    }

    // GET — return page + sanitized HTML
    if (req.method === 'GET') {
      const denied = await requireProjectPermission(
        projectId,
        'wiki.view',
        session,
      )
      if (denied) {
        throw new ApiError(denied.status, denied.code, 'Cannot view wiki page')
      }

      const html = await renderMarkdown(page.content)
      const { _count, ...pageWithoutCount } = page
      return res
        .status(200)
        .json({
          success: true,
          data: { ...pageWithoutCount, versionCount: _count.versions, html },
        })
    }

    // PATCH — update content (and/or title) + new version
    if (req.method === 'PATCH') {
      const denied = await requireProjectPermission(
        projectId,
        'wiki.edit',
        session,
      )
      if (denied) {
        throw new ApiError(
          denied.status,
          denied.code,
          'Insufficient permission to edit wiki page',
        )
      }

      const { title, content, parentId } = body

      // If content is being updated, increment version + create version row
      const isContentUpdate = content !== undefined && content !== page.content

      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.wikiPage.update({
          where: { id: page.id },
          data: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
            ...(parentId !== undefined && { parentId: parentId ?? null }),
            ...(isContentUpdate && { version: { increment: 1 } }),
          },
          include: PAGE_INCLUDE,
        })
        if (isContentUpdate) {
          await tx.wikiPageVersion.create({
            data: {
              wikiPageId: page.id,
              content: content!,
              authorId: session.user.id,
              version: next.version,
            },
          })
        }
        return next
      })

      const html = await renderMarkdown(updated.content)
      const { _count, ...updatedWithoutCount } = updated
      return res
        .status(200)
        .json({
          success: true,
          data: { ...updatedWithoutCount, versionCount: _count.versions, html },
        })
    }

    // DELETE — hard delete (cascades versions)
    if (req.method === 'DELETE') {
      const denied = await requireProjectPermission(
        projectId,
        'wiki.delete',
        session,
      )
      if (denied) {
        throw new ApiError(
          denied.status,
          denied.code,
          'Insufficient permission to delete wiki page',
        )
      }

      await prisma.wikiPage.delete({ where: { id: page.id } })
      return res.status(204).end()
    }

    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updatePageSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
