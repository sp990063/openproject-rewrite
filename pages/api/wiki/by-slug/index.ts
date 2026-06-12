import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertWikiPageBySlugProjectMembership } from '@/lib/auth/project'

// WIKI-3: projectId is now REQUIRED on the query so the lookup is fully
// project-scoped. The schema-level unique key is (projectId, slug), so
// without projectId we cannot disambiguate across projects (and a member
// of project A could otherwise read a page from project B that happens
// to share the same slug).
const querySchema = z.object({
  slug: z.string(),
  projectId: z.string(),
})

export default withRoute<unknown, z.input<typeof querySchema>, unknown>(
  async ({ req, res, query, session }) => {
    if (req.method !== 'GET') return undefined

    // Project membership gate (B-3.1b). Slug is project-scoped, so we
    // resolve slug -> pageId -> projectId, then assert membership.
    await assertWikiPageBySlugProjectMembership(
      query.slug,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    // WIKI-3: filter by BOTH projectId and slug. Defense-in-depth in case
    // the helper matched an unexpected project (the helper picks the
    // first match globally — but the projectId gate is now explicit).
    const wikiPage = await prisma.wikiPage.findFirst({
      where: { slug: query.slug, projectId: query.projectId },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parent: { select: { id: true, title: true, slug: true } },
        children: { select: { id: true, title: true, slug: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    if (!wikiPage) {
      throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
    }

    return res.status(200).json({ success: true, data: wikiPage })
  },
  {
    methods: ['GET'],
    querySchema,
  }
)