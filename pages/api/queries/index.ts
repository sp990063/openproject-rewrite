import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const createQuerySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  projectId: z.string().cuid().nullable().optional(),
  filters: z.record(z.unknown()).default({}),
  sortBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).optional().default('asc'),
  })).default([]),
  groupBy: z.string().nullable().optional(),
  displayMode: z.enum(['table', 'gantt', 'board', 'calendar']).default('table'),
  isDefault: z.boolean().default(false),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const userId = session.user.id

  if (req.method === 'GET') {
    const { projectId } = req.query
    const queries = await prisma.savedQuery.findMany({
      where: {
        userId,
        ...(projectId ? { projectId: String(projectId) } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    })
    return res.status(200).json(queries)
  }

  if (req.method === 'POST') {
    try {
      const data = createQuerySchema.parse(req.body)

      // If isDefault=true, unset other defaults for this user/project first
      if (data.isDefault) {
        await prisma.savedQuery.updateMany({
          where: { userId, projectId: data.projectId ?? null },
          data: { isDefault: false },
        })
      }

      const query = await prisma.savedQuery.create({
        data: {
          userId,
          projectId: data.projectId ?? null,
          name: data.name,
          filters: data.filters,
          sortBy: data.sortBy,
          groupBy: data.groupBy,
          displayMode: data.displayMode,
          isDefault: data.isDefault,
        },
      })
      return res.status(201).json(query)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.issues })
      }
      throw error
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
