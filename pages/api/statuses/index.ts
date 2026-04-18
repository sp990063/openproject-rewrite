import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const statuses = await prisma.status.findMany({
      orderBy: { position: 'asc' },
    })

    return res.status(200).json(statuses)
  } catch (error) {
    console.error('Error fetching statuses:', error)
    return res.status(500).json({ error: 'Failed to fetch statuses' })
  }
}
