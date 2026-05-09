import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const updateQuerySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  filters: z.record(z.unknown()).optional(),
  sortBy: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).optional().default('asc'),
  })).optional(),
  groupBy: z.string().nullable().optional(),
  displayMode: z.enum(['table', 'gantt', 'board', 'calendar']).optional(),
  isDefault: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  const userId = session.user.id

  // GET /api/queries/[id]
  if (req.method === 'GET') {
    const query = await prisma.savedQuery.findFirst({
      where: { id: String(id), userId },
    })
    if (!query) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json(query)
  }

  // PATCH /api/queries/[id]
  if (req.method === 'PATCH') {
    try {
      const data = updateQuerySchema.parse(req.body)

      // First get existing to know projectId for isDefault logic
      const existing = await prisma.savedQuery.findFirst({ where: { id: String(id), userId } })
      if (!existing) return res.status(404).json({ error: 'Not found' })

      // If isDefault=true, unset other defaults first
      if (data.isDefault) {
        await prisma.savedQuery.updateMany({
          where: {
            userId,
            projectId: existing.projectId ?? null,
            id: { not: String(id) },
          },
          data: { isDefault: false },
        })
      }

      await prisma.savedQuery.updateMany({
        where: { id: String(id), userId },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.filters !== undefined ? { filters: data.filters } : {}),
          ...(data.sortBy !== undefined ? { sortBy: data.sortBy } : {}),
          ...(data.groupBy !== undefined ? { groupBy: data.groupBy } : {}),
          ...(data.displayMode !== undefined ? { displayMode: data.displayMode } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      })
      const updated = await prisma.savedQuery.findFirst({ where: { id: String(id) } })
      if (!updated) return res.status(404).json({ error: 'Not found' })
      return res.status(200).json(updated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.issues })
      }
      throw error
    }
  }

  // DELETE /api/queries/[id]
  if (req.method === 'DELETE') {
    await prisma.savedQuery.deleteMany({ where: { id: String(id), userId } })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
