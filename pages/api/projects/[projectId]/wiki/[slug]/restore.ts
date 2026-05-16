
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitActivity, makeSubjectId } from '@/lib/activity'

const RestoreVersionSchema = z.object({
  version: z.number().int().positive(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId, slug } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' })
  }

  // POST /api/projects/[projectId]/wiki/[slug]/restore — restore a specific version
  if (req.method === 'POST') {
    const parsed = RestoreVersionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
    }

    const currentPage = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
    })

    if (!currentPage) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    const versionRecord = await prisma.wikiPageVersion.findFirst({
      where: {
        wikiPageId: currentPage.id,
        version: parsed.data.version,
      },
    })

    if (!versionRecord) {
      return res.status(404).json({ error: 'Version not found' })
    }

    // Restore by creating a new version with the old content
    // This preserves history - we don't delete any versions
    const updated = await prisma.$transaction(async (tx) => {
      // Save current content as a version first (if content changed)
      if (currentPage.content !== versionRecord.content) {
        await tx.wikiPageVersion.create({
          data: {
            wikiPageId: currentPage.id,
            content: currentPage.content,
            authorId: currentPage.authorId,
            version: currentPage.version,
          },
        })
      }

      return tx.wikiPage.update({
        where: { id: currentPage.id },
        data: {
          content: versionRecord.content,
          version: { increment: 1 },
        },
        include: {
          author: { select: { id: true, name: true } },
        },
      })
    })

    // Emit activity for wiki page restore
    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'wiki_page',
      subjectId: makeSubjectId('wiki_page', updated.id),
      action: 'restored',
      reference: {
        type: 'WikiPage',
        id: updated.id,
        subject: updated.title,
        projectName: '',
        actorName: session.user.name ?? '',
      },
    })

    return res.json({ page: updated })
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
