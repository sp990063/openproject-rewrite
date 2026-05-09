import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const restoreSchema = z.object({
  version: z.number().int().positive(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Wiki page ID is required' })
  }

  switch (req.method) {
    case 'POST':
      return restoreVersion(req, res, id)
    default:
      res.setHeader('Allow', ['POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function restoreVersion(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const { version } = restoreSchema.parse(req.body)

    // Get the wiki page
    const page = await prisma.wikiPage.findUnique({
      where: { id },
    })
    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    // Find the version to restore
    const targetVersion = await prisma.wikiPageVersion.findFirst({
      where: { wikiPageId: id, version },
    })
    if (!targetVersion) {
      return res.status(404).json({ error: `Version ${version} not found` })
    }

    const newVersion = page.version + 1

    // Update page content to the target version and create a new version entry
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

      // Create new version entry recording the restore
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

    return res.status(200).json(wikiPage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error restoring wiki page version:', error)
    return res.status(500).json({ error: 'Failed to restore wiki page version' })
  }
}
