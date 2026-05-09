import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId } = req.query

  if (req.method === 'GET') {
    const sprints = await prisma.sprint.findMany({
      where: { projectId: projectId as string },
      include: { sprintMembers: true },
      orderBy: { startDate: 'asc' },
    })
    return res.json({ sprints })
  }

  if (req.method === 'POST') {
    const { name, startDate, endDate, capacity } = req.body
    if (!name || !startDate || !endDate) return res.status(400).json({ error: 'Missing required fields' })
    const sprint = await prisma.sprint.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        capacity: capacity ? parseFloat(capacity) : null,
        projectId: projectId as string,
      },
    })
    return res.json({ sprint })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
