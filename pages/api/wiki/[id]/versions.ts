import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Wiki page ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getVersions(req, res, id)
    default:
      res.setHeader('Allow', ['GET'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getVersions(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Verify wiki page exists
    const page = await prisma.wikiPage.findUnique({ where: { id } })
    if (!page) {
      return res.status(404).json({ error: 'Wiki page not found' })
    }

    const versions = await prisma.wikiPageVersion.findMany({
      where: { wikiPageId: id },
      select: {
        id: true,
        version: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { version: 'desc' },
    })

    return res.status(200).json(versions)
  } catch (error) {
    console.error('Error fetching wiki page versions:', error)
    return res.status(500).json({ error: 'Failed to fetch wiki page versions' })
  }
}
