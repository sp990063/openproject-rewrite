import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import { authOptions } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // Phase 5 3-angle review P0: add auth gate (was missing — anonymous
  // callers could export any wiki page content as PDF/JSON if they
  // guessed the slug + projectId). Same pattern as Phase 4 Sprint 5's
  // /api/search fix, Phase 5 Sprint 1's /api/time-reports fix, and
  // Sprint 4's /api/time-entries fix.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'))
  }
  const viewerId = session.user.id

  try {
    const { slug, projectId } = req.query

    if (!slug || !projectId) {
      return res.status(400).json({ error: 'Slug and projectId are required' })
    }

    // Authorization: caller must be a member of the project the wiki
    // page belongs to (or admin). Avoids leaking wiki content from
    // projects the caller can't normally see.
    const isAdmin = await prisma.user.findUnique({
      where: { id: viewerId },
      select: { isSystemAdmin: true },
    }).then((u) => u?.isSystemAdmin === true)
    if (!isAdmin) {
      const membership = await prisma.member.findFirst({
        where: { projectId: projectId as string, userId: viewerId },
        select: { id: true },
      })
      if (!membership) {
        return res.status(403).json(errorResponse('FORBIDDEN', 'Not a member of this project'))
      }
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
    return res.status(200).json(successResponse(wikiPage))
  } catch (error) {
    console.error('Error exporting wiki page:', error)
    return res.status(500).json({ error: 'Failed to export wiki page' })
  }
}
