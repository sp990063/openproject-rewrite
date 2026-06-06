// pages/api/projects/[projectId]/wiki/index.ts
//
// Wiki list + create (spec §2.4, §2.5)
//
//   GET  /api/projects/[projectId]/wiki        — list all wiki pages (requires wiki.view)
//   POST /api/projects/[projectId]/wiki        — create a new wiki page (requires wiki.edit)
//
// List returns pages ordered by `updatedAt DESC` (most recently edited
// first), with author name + version count. No body content (use
// `/wiki/[slug]` to fetch a single page).
//
// Create: caller provides { title, content, parentId? }. Slug is auto-
// generated from title and uniquified within the project. On collision,
// appends "-2", "-3", etc. The initial version (1) is recorded as a
// WikiPageVersion on the same transaction.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { requireProjectPermission } from '@/lib/permissions/check'
import { generateSlug, uniqueSlug } from '@/lib/slug'

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string(),
  parentId: z.string().nullable().optional(),
})

const WIKI_INCLUDE = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  parent: { select: { id: true, title: true, slug: true } },
  children: { select: { id: true, title: true, slug: true } },
  _count: { select: { versions: true } },
} as const

export default withRoute<
  z.infer<typeof createPageSchema>,
  unknown,
  { projectId: string }
>(
  async ({ req, res, session, body, params }) => {
    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    // GET — list wiki pages
    if (req.method === 'GET') {
      const denied = await requireProjectPermission(
        projectId,
        'wiki.view',
        session,
      )
      if (denied) {
        throw new ApiError(denied.status, denied.code, 'Cannot view wiki')
      }

      const pages = await prisma.wikiPage.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        include: WIKI_INCLUDE,
      })

      // Flatten `_count.versions` into a top-level `versionCount` for
      // consumer compat with the pre-existing `WikiPageWithMeta` type.
      const data = pages.map(({ _count, ...rest }) => ({
        ...rest,
        versionCount: _count.versions,
      }))
      return res.status(200).json({ success: true, data })
    }

    // POST — create a new page
    if (req.method === 'POST') {
      const denied = await requireProjectPermission(
        projectId,
        'wiki.edit',
        session,
      )
      if (denied) {
        throw new ApiError(
          denied.status,
          denied.code,
          'Insufficient permission to create wiki page',
        )
      }

      const { title, content, parentId } = body

      // Verify parent exists and belongs to the same project
      if (parentId) {
        const parent = await prisma.wikiPage.findUnique({
          where: { id: parentId },
          select: { projectId: true },
        })
        if (!parent || parent.projectId !== projectId) {
          throw new ApiError(
            400,
            'INVALID_PARENT',
            'Parent page does not exist in this project',
          )
        }
      }

      // Generate a unique slug
      const baseSlug = generateSlug(title)
      const existing = await prisma.wikiPage.findMany({
        where: { projectId },
        select: { slug: true },
      })
      const slug = uniqueSlug(
        baseSlug,
        existing.map((p) => p.slug),
      )

      // Create page + initial version atomically
      const page = await prisma.$transaction(async (tx) => {
        const created = await tx.wikiPage.create({
          data: {
            projectId,
            title,
            slug,
            content,
            parentId: parentId ?? null,
            authorId: session.user.id,
            version: 1,
          },
          include: WIKI_INCLUDE,
        })
        await tx.wikiPageVersion.create({
          data: {
            wikiPageId: created.id,
            content,
            authorId: session.user.id,
            version: 1,
          },
        })
        return created
      })

      return res.status(201).json({ success: true, data: page })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createPageSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
