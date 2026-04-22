import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { auth } from '@/lib/auth'

const querySchema = z.object({
  projectId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  filters: z.record(z.unknown()),
  sortBy: z.array(z.tuple([z.string(), z.enum(['asc', 'desc'])])),
  groupBy: z.string().nullable().optional(),
  displayMode: z.enum(['table', 'gantt', 'board', 'calendar']).default('table'),
  isDefault: z.boolean().default(false),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      return getQueries(req, res)
    case 'POST':
      return createQuery(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getQueries(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { projectId } = req.query
    const session = await auth()

    // Filter by userId if authenticated; return empty list for unauthenticated
    const where = projectId ? { projectId: projectId as string } : {}
    if (session?.user?.id) {
      where.userId = session.user.id
    } else {
      // Unauthenticated — return only queries with userId = 'anonymous' or no restriction
      // For now: return nothing to unauthenticated users
      return res.status(200).json([])
    }

    const queries = await prisma.query.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })

    return res.status(200).json(queries)
  } catch (error) {
    console.error('Error fetching queries:', error)
    return res.status(500).json({ error: 'Failed to fetch queries' })
  }
}

async function createQuery(req: NextApiRequest, res: NextApiResponse) {
  try {
    const body = querySchema.parse(req.body)
    const session = await auth()
    const userId = session?.user?.id ?? 'anonymous'

    // If setting as default, unset other defaults first
    if (body.isDefault) {
      await prisma.query.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const query = await prisma.query.create({
      data: {
        userId,
        projectId: body.projectId ?? null,
        name: body.name,
        filters: body.filters,
        sortBy: body.sortBy,
        groupBy: body.groupBy ?? null,
        displayMode: body.displayMode,
        isDefault: body.isDefault,
      },
    })

    return res.status(201).json(query)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating query:', error)
    return res.status(500).json({ error: 'Failed to create query' })
  }
}
