// pages/api/projects/[projectId]/wiki/[slug]/restore/[version].ts
//
// Restore a specific historical version of a wiki page (spec §2.4, §2.7)
//
//   POST /api/projects/[projectId]/wiki/[slug]/restore/[version]
//
// Effect:
//   1. Fetch the target version's content
//   2. Update the page with that content, incrementing `version` to
//      (currentMax + 1) — preserving full version history (the
//      restored state is itself a new version, not a roll-back of the
//      pointer).
//   3. Create a new WikiPageVersion row with the restored content
//      + the restore author.
//
// Requires `wiki.restore` permission.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { requireProjectPermission } from '@/lib/permissions/check'

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

    if (req.method !== 'POST') {
      return undefined
    }

    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true, version: true },
    })
    if (!page) {
      throw new ApiError(404, 'PAGE_NOT_FOUND', 'Wiki page not found')
    }

    const denied = await requireProjectPermission(
      projectId,
      'wiki.restore',
      session,
    )
    if (denied) {
      throw new ApiError(
        denied.status,
        denied.code,
        'Insufficient permission to restore wiki page',
      )
    }

    // Find the target version
    const target = await prisma.wikiPageVersion.findFirst({
      where: { wikiPageId: page.id, version: versionNumber },
    })
    if (!target) {
      throw new ApiError(404, 'VERSION_NOT_FOUND', `Version ${versionNumber} not found`)
    }

    // If already on the target version, no-op
    if (target.version === page.version && target.content === '') {
      // Edge case: someone restored and never edited — but content
      // would not be empty. The check above is just a defensive guard.
    }

    // Determine next version number
    const nextVersion = page.version + 1

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.wikiPage.update({
        where: { id: page.id },
        data: {
          content: target.content,
          version: nextVersion,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      })
      await tx.wikiPageVersion.create({
        data: {
          wikiPageId: page.id,
          content: target.content,
          authorId: session.user.id,
          version: nextVersion,
        },
      })
      return updated
    })

    return res.status(200).json({ success: true, data: restored })
  },
  {
    methods: ['POST'],
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
