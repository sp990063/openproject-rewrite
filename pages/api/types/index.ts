import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const types = await prisma.type.findMany({
      orderBy: { position: 'asc' },
    })

    return res.status(200).json(types)
  } catch (error) {
    console.error('Error fetching types:', error)
    return res.status(500).json({ error: 'Failed to fetch types' })
  }
}
