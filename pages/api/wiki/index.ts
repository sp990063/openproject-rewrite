// pages/api/wiki/index.ts
// Refactored to use withRoute HOF (Phase 1 of migration plan)
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/markdown'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const querySchema = z.object({
  projectId: z.string().optional(),
})

const createWikiPageSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  content: z.string().optional().default(''),
  parentId: z.string().cuid().optional(),
  authorId: z.string(),
})

export default withRoute<z.infer<typeof createWikiPageSchema>, z.input<typeof querySchema>, unknown>(
  async ({ req, res, body, query }) => {
    // GET /api/wiki?projectId=... — list wiki pages
    if (req.method === 'GET') {
      const where: { projectId?: string } = {}
      if (query.projectId) where.projectId = query.projectId

      const wikiPages = await prisma.wikiPage.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          parent: { select: { id: true, title: true, slug: true } },
          _count: { select: { children: true, versions: true } },
        },
        orderBy: { title: 'asc' },
      })
      return res.status(200).json({ success: true, data: wikiPages })
    }

    // POST /api/wiki — create a wiki page (body validated)
    if (req.method === 'POST') {
      const slug = generateSlug(body.title)

      const existing = await prisma.wikiPage.findUnique({
        where: { projectId_slug: { projectId: body.projectId, slug } },
      })
      if (existing) {
        throw new ApiError(
          409,
          'WIKI_PAGE_EXISTS',
          'A wiki page with this title already exists in the project'
        )
      }

      const wikiPage = await prisma.$transaction(async (tx) => {
        const page = await tx.wikiPage.create({
          data: {
            projectId: body.projectId,
            title: body.title,
            slug,
            content: body.content,
            parentId: body.parentId,
            authorId: body.authorId,
            version: 1,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            parent: { select: { id: true, title: true, slug: true } },
          },
        })
        await tx.wikiPageVersion.create({
          data: {
            wikiPageId: page.id,
            content: body.content ?? '',
            authorId: body.authorId,
            version: 1,
          },
        })
        return page
      })

      return res.status(201).json({ success: true, data: wikiPage })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createWikiPageSchema,
    querySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
