// pages/api/projects/[projectId]/wiki/[slug]/versions/[version].ts
//
// Get a specific version's content (spec §2.4, §2.7)
//
//   GET /api/projects/[projectId]/wiki/[slug]/versions/[version]
//
// Returns the version's content as raw Markdown + sanitized HTML.
// Does NOT mutate the current page — read-only. To restore, use the
// `/restore/[version]` sibling endpoint.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { requireProjectPermission } from '@/lib/permissions/check'
import { renderMarkdown } from '@/lib/markdown'

export default withRoute<
  unknown,
  unknown,
  { projectId: string; slug: string; version: string }
>(
  async ({ req, res, session, params }) => {
    const { projectId, slug, version } = params
    if (!projectId || !slug || !version) {
      throw new ApiError(
        400,
        'BAD_REQUEST',
        'Project ID, slug, and version are required',
      )
    }

    const versionNumber = Number.parseInt(version, 10)
    if (Number.isNaN(versionNumber) || versionNumber < 1) {
      throw new ApiError(400, 'BAD_REQUEST', 'Version must be a positive integer')
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

    const versionRow = await prisma.wikiPageVersion.findFirst({
      where: { wikiPageId: page.id, version: versionNumber },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })
    if (!versionRow) {
      throw new ApiError(404, 'VERSION_NOT_FOUND', `Version ${versionNumber} not found`)
    }

    const html = await renderMarkdown(versionRow.content)
    return res.status(200).json({
      success: true,
      data: {
        id: versionRow.id,
        version: versionRow.version,
        content: versionRow.content,
        html,
        createdAt: versionRow.createdAt,
        author: versionRow.author,
      },
    })
  },
  {
    methods: ['GET'],
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
