import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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