import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, sprintId } = req.query

  if (req.method === 'GET') {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId as string },
      include: { sprintMembers: true, burndownData: { orderBy: { date: 'asc' } } },
    })
    if (!sprint || sprint.projectId !== projectId) return res.status(404).json({ error: 'Sprint not found' })
    return res.json({ sprint })
  }

  if (req.method === 'PATCH') {
    const { name, startDate, endDate, capacity, status } = req.body
    const sprint = await prisma.sprint.update({
      where: { id: sprintId as string },
      data: {
        ...(name && { name }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(capacity !== undefined && { capacity: capacity ? parseFloat(capacity) : null }),
        ...(status && { status }),
      },
    })
    return res.json({ sprint })
  }

  if (req.method === 'DELETE') {
    await prisma.sprint.delete({ where: { id: sprintId as string } })
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
