import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { auth } from '@/lib/auth'

const updateQuerySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  filters: z.record(z.unknown()).optional(),
  sortBy: z.array(z.tuple([z.string(), z.enum(['asc', 'desc'])])).optional(),
  groupBy: z.string().nullable().optional(),
  displayMode: z.enum(['table', 'gantt', 'board', 'calendar']).optional(),
  isDefault: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Query ID is required' })
  }

  // Rate limiting for write methods
  if (process.env.NODE_ENV !== 'test' && req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  switch (req.method) {
    case 'GET':
      return getQuery(req, res, id)
    case 'PATCH':
      return updateQuery(req, res, id)
    case 'DELETE':
      return deleteQuery(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getQuery(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const query = await prisma.query.findUnique({ where: { id } })
    if (!query) {
      return res.status(404).json({ error: 'Query not found' })
    }
    return res.status(200).json(query)
  } catch (error) {
    console.error('Error fetching query:', error)
    return res.status(500).json({ error: 'Failed to fetch query' })
  }
}

async function updateQuery(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const body = updateQuerySchema.parse(req.body)
    const session = await auth()
    const userId = session?.user?.id ?? 'anonymous'

    // If setting as default, unset other defaults first
    if (body.isDefault) {
      await prisma.query.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const query = await prisma.query.update({
      where: { id },
      data: body,
    })

    return res.status(200).json(query)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating query:', error)
    return res.status(500).json({ error: 'Failed to update query' })
  }
}

async function deleteQuery(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await prisma.query.delete({ where: { id } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting query:', error)
    return res.status(500).json({ error: 'Failed to delete query' })
  }
}
