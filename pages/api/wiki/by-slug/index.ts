import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute } from '@/lib/api/withRoute'
import { assertWikiPageBySlugProjectMembership } from '@/lib/auth/project'

const querySchema = z.object({
  slug: z.string(),
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

    const wikiPage = await prisma.wikiPage.findFirst({
      where: { slug: query.slug },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parent: { select: { id: true, title: true, slug: true } },
        children: { select: { id: true, title: true, slug: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    return res.status(200).json({ success: true, data: wikiPage })
  },
  {
    methods: ['GET'],
    querySchema,
  }
)
