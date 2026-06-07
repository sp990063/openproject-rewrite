import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth gate (Phase 7 Sprint A4 P0 fix)
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const { slug } = req.query

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'Wiki page slug is required' })
    }

    // Find wiki page by slug
    // Note: We need to find by slug since we don't know projectId from the URL alone
    // The client will call with projectId as query param for filtering
    const wikiPage = await prisma.wikiPage.findFirst({
      where: { slug },
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
    console.error('Error fetching wiki page by slug:', error)
    return res.status(500).json({ error: 'Failed to fetch wiki page' })
  }
}