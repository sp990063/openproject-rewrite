import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/ratelimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Relation ID is required' })
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  // Rate limiting
  if (process.env.NODE_ENV !== 'test') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  try {
    await prisma.workPackageRelation.delete({
      where: { id },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting relation:', error)
    return res.status(500).json({ error: 'Failed to delete relation' })
  }
}
