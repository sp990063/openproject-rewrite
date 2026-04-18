import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const priorities = await prisma.priority.findMany({
      orderBy: { position: 'asc' },
    })
    return res.status(200).json(priorities)
  } catch (error) {
    console.error('Error fetching priorities:', error)
    return res.status(500).json({ error: 'Failed to fetch priorities' })
  }
}
