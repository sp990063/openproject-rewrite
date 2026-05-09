import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateSlug } from '@/lib/markdown'

const updateWikiPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  parentId: z.string().nullish().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Wiki page ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getWikiPage(req, res, id)
    case 'PATCH':
      return updateWikiPage(req, res, id)
    case 'DELETE':
      return deleteWikiPage(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWikiPage(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const wikiPage = await prisma.wikiPage.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parent: { select: { id: true, title: true, slug: true } },
        children: { select: { id: true, title: true, slug: true } },
        project: { select: { id: true, name: true, identifier: true } },
      },
    })

    if (!wikiPage) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    return res.status(200).json(wikiPage)
  } catch (error) {
    console.error('Error fetching wiki page:', error)
    return res.status(500).json({ error: 'Failed to fetch wiki page' })
  }
}

async function updateWikiPage(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateWikiPageSchema.parse(req.body)

    // Get current page to know the current version and author
    const currentPage = await prisma.wikiPage.findUnique({
      where: { id },
    })
    if (!currentPage) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    // If title is changed, regenerate slug and check for conflicts
    let newSlug = currentPage.slug
    if (data.title) {
      newSlug = generateSlug(data.title)
      const existing = await prisma.wikiPage.findUnique({
        where: { projectId_slug: { projectId: currentPage.projectId, slug: newSlug } },
      })
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'A wiki page with this title already exists in the project' })
      }
    }

    const newVersion = currentPage.version + 1

    // Update page + create new version in transaction
    const wikiPage = await prisma.$transaction(async (tx) => {
      const updated = await tx.wikiPage.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title, slug: newSlug }),
          ...(data.content !== undefined && { content: data.content }),
          ...(data.parentId !== undefined && { parentId: data.parentId === null ? null : data.parentId }),
          version: newVersion,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          parent: { select: { id: true, title: true, slug: true } },
          children: { select: { id: true, title: true, slug: true } },
          project: { select: { id: true, name: true, identifier: true } },
        },
      })

      // Create new version entry
      await tx.wikiPageVersion.create({
        data: {
          wikiPageId: id,
          content: data.content ?? currentPage.content,
          authorId: currentPage.authorId,
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
    console.error('Error updating wiki page:', error)
    return res.status(500).json({ error: 'Failed to update wiki page' })
  }
}

async function deleteWikiPage(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Check if page exists
    const page = await prisma.wikiPage.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    })
    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }
    if (page._count.children > 0) {
      return res.status(400).json({ error: 'Cannot delete a wiki page that has child pages. Delete or move the children first.' })
    }

    await prisma.wikiPage.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting wiki page:', error)
    return res.status(500).json({ error: 'Failed to delete wiki page' })
  }
}
