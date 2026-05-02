import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await auth()
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
    const { name, filters, sortBy, groupBy, displayMode, isDefault } = req.body

    // If isDefault=true, unset other defaults first
    if (isDefault) {
      const existing = await prisma.savedQuery.findFirst({ where: { id: String(id), userId } })
      await prisma.savedQuery.updateMany({
        where: {
          userId,
          projectId: existing?.projectId ?? null,
          id: { not: String(id) },
        },
        data: { isDefault: false },
      })
    }

    await prisma.savedQuery.updateMany({
      where: { id: String(id), userId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(filters !== undefined ? { filters } : {}),
        ...(sortBy !== undefined ? { sortBy } : {}),
        ...(groupBy !== undefined ? { groupBy } : {}),
        ...(displayMode !== undefined ? { displayMode } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    })
    const updated = await prisma.savedQuery.findFirst({ where: { id: String(id) } })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json(updated)
  }

  // DELETE /api/queries/[id]
  if (req.method === 'DELETE') {
    await prisma.savedQuery.deleteMany({ where: { id: String(id), userId } })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
