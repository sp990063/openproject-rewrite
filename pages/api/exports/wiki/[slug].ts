import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const { slug, projectId } = req.query

    if (!slug || !projectId) {
      return res.status(400).json({ error: 'Slug and projectId are required' })
    }

    const wikiPage = await prisma.wikiPage.findFirst({
      where: {
        slug: slug as string,
        projectId: projectId as string,
      },
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

    const format = req.query.format as string

    if (format === 'pdf') {
      // Render markdown to HTML for PDF
      const renderedHtml = await renderMarkdown(wikiPage.content)

      // Return HTML content that can be rendered and captured by client-side PDF generation
      return res.status(200).json({
        success: true,
        data: {
          id: wikiPage.id,
          title: wikiPage.title,
          content: wikiPage.content,
          renderedHtml,
          author: wikiPage.author,
          project: wikiPage.project,
          version: wikiPage.version,
          updatedAt: wikiPage.updatedAt.toISOString(),
          parent: wikiPage.parent,
          children: wikiPage.children,
        },
      })
    }

    // Default: return JSON
    return res.status(200).json({
      success: true,
      data: wikiPage,
    })
  } catch (error) {
    console.error('Error exporting wiki page:', error)
    return res.status(500).json({ error: 'Failed to export wiki page' })
  }
}
