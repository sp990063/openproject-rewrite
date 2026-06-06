// pages/api/projects/[projectId]/wiki/[slug]/versions/index.ts
//
// List version history for a wiki page (spec §2.4, §2.7)
//
//   GET /api/projects/[projectId]/wiki/[slug]/versions
//
// Returns a chronologically ordered list (newest first) of all
// WikiPageVersion rows for the page, with author info. The `content`
// field is NOT included in the list response (use the per-version
// endpoint to fetch a specific version's full content).
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { requireProjectPermission } from '@/lib/permissions/check'

export default withRoute<unknown, unknown, { projectId: string; slug: string }>(
  async ({ req, res, session, params }) => {
    const { projectId, slug } = params
    if (!projectId || !slug) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID and slug are required')
    }

    if (req.method !== 'GET') {
      return undefined
    }

    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true },
    })
    if (!page) {
      throw new ApiError(404, 'PAGE_NOT_FOUND', 'Wiki page not found')
    }

    const denied = await requireProjectPermission(
      projectId,
      'wiki.view',
      session,
    )
    if (denied) {
      throw new ApiError(denied.status, denied.code, 'Cannot view wiki page')
    }

    const versions = await prisma.wikiPageVersion.findMany({
      where: { wikiPageId: page.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        wikiPageId: page.id,
        wikiPageTitle: page.title,
        versions,
      },
    })
  },
  {
    methods: ['GET'],
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
