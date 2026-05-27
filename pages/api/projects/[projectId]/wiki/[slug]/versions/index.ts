import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' })
  }

  const rawProjectId = req.query['projectId']
  const rawSlug = req.query['slug']
  const projectId = typeof rawProjectId === 'string' ? rawProjectId : String(rawProjectId ?? '')
  const slug = typeof rawSlug === 'string' ? rawSlug : String(rawSlug ?? '')

  if (!projectId || !slug) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'Invalid parameters' })
  }

  // GET /api/projects/[projectId]/wiki/[slug]/versions — list all versions for a wiki page
  if (req.method === 'GET') {
    // First check if the wiki page exists
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true, title: true },
    })

    if (!page) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Wiki page not found' })
    }

    const versions = await prisma.wikiPageVersion.findMany({
      where: { wikiPageId: page.id },
      orderBy: { version: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    })

    return res.json({
      wikiPageId: page.id,
      wikiPageTitle: page.title,
      versions,
    })
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' })
}
