import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { generateSlug } from '@/lib/markdown'

const createWikiPageSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  content: z.string().optional().default(''),
  parentId: z.string().cuid().optional(),
  authorId: z.string(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  switch (req.method) {
    case 'GET':
      return getWikiPages(req, res)
    case 'POST':
      return createWikiPage(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWikiPages(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId } = req.query

    const where: { projectId?: string } = {}
    if (projectId) where.projectId = projectId as string

    const wikiPages = await prisma.wikiPage.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parent: { select: { id: true, title: true, slug: true } },
        _count: { select: { children: true, versions: true } },
      },
      orderBy: { title: 'asc' },
    })

    return res.status(200).json(wikiPages)
  } catch (error) {
    console.error('Error fetching wiki pages:', error)
    return res.status(500).json({ error: 'Failed to fetch wiki pages' })
  }
}

async function createWikiPage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createWikiPageSchema.parse(req.body)
    const slug = generateSlug(data.title)

    // Check if wiki page with same slug already exists in project
    const existing = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId: data.projectId, slug } },
    })
    if (existing) {
      return res.status(400).json({ error: 'A wiki page with this title already exists in the project' })
    }

    // Create wiki page + initial version in a transaction
    const wikiPage = await prisma.$transaction(async (tx) => {
      const page = await tx.wikiPage.create({
        data: {
          projectId: data.projectId,
          title: data.title,
          slug,
          content: data.content,
          parentId: data.parentId,
          authorId: data.authorId,
          version: 1,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          parent: { select: { id: true, title: true, slug: true } },
        },
      })

      // Create initial version
      await tx.wikiPageVersion.create({
        data: {
          wikiPageId: page.id,
          content: data.content ?? '',
          authorId: data.authorId,
          version: 1,
        },
      })

      return page
    })

    return res.status(201).json(wikiPage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating wiki page:', error)
    return res.status(500).json({ error: 'Failed to create wiki page' })
  }
}
