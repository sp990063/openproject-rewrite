import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertWikiPageProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

const restoreSchema = z.object({
  version: z.number().int().positive(),
})

export default withRoute<z.infer<typeof restoreSchema>, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, body, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.1b).
    await assertWikiPageProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'POST') {
      const page = await prisma.wikiPage.findUnique({ where: { id } })
      if (!page) {
        throw new ApiError(404, 'WIKI_PAGE_NOT_FOUND', 'Wiki page not found')
      }

      const targetVersion = await prisma.wikiPageVersion.findFirst({
        where: { wikiPageId: id, version: body.version },
      })
      if (!targetVersion) {
        throw new ApiError(404, 'WIKI_VERSION_NOT_FOUND', `Version ${body.version} not found`)
      }

      const newVersion = page.version + 1

      const wikiPage = await prisma.$transaction(async (tx) => {
        const updated = await tx.wikiPage.update({
          where: { id },
          data: {
            content: targetVersion.content,
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
            content: targetVersion.content,
            authorId: page.authorId,
            version: newVersion,
          },
        })

        return updated
      })

      return res.status(200).json({ success: true, data: wikiPage })
    }

    return undefined
  },
  {
    methods: ['POST'],
    bodySchema: restoreSchema,
    paramsSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
