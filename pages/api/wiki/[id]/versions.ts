import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute } from '@/lib/api/withRoute'
import { assertWikiPageProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

export default withRoute<unknown, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.1b).
    await assertWikiPageProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'GET') {
      const versions = await prisma.wikiPageVersion.findMany({
        where: { wikiPageId: id },
        select: {
          id: true,
          version: true,
          content: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { version: 'desc' },
      })

      return res.status(200).json({ success: true, data: versions })
    }

    return undefined
  },
  {
    methods: ['GET'],
    paramsSchema,
  }
)
