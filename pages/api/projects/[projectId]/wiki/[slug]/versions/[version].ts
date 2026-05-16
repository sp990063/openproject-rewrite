
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId, slug, version } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Invalid slug' })
  }
  if (!version || typeof version !== 'string' || isNaN(parseInt(version, 10))) {
    return res.status(400).json({ error: 'Invalid version number' })
  }

  const versionNum = parseInt(version, 10)

  // GET /api/projects/[projectId]/wiki/[slug]/versions/[version] — get specific version content
  if (req.method === 'GET') {
    const page = await prisma.wikiPage.findUnique({
      where: { projectId_slug: { projectId, slug } },
      select: { id: true },
    })

    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    const versionRecord = await prisma.wikiPageVersion.findFirst({
      where: {
        wikiPageId: page.id,
        version: versionNum,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    if (!versionRecord) {
      return res.status(404).json({ error: 'Version not found' })
    }

    return res.json({ version: versionRecord })
  }

  res.setHeader('Allow', ['GET'])
  return res.status(405).json({ error: 'Method not allowed' })
}
