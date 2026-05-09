import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { sprintId } = req.query

  if (req.method === 'GET') {
    const data = await prisma.burndownData.findMany({
      where: { sprintId: sprintId as string },
      orderBy: { date: 'asc' },
    })
    return res.json({ burndown: data })
  }

  if (req.method === 'POST') {
    const { date, remaining } = req.body
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId as string } })
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' })

    const start = new Date(sprint.startDate).getTime()
    const end = new Date(sprint.endDate).getTime()
    const now = new Date(date).getTime()
    const totalPoints = sprint.capacity ?? 100
    const totalDays = (end - start) / 86400000
    const daysPassed = (now - start) / 86400000
    const ideal = Math.max(0, totalPoints - (totalPoints / totalDays) * daysPassed)

    const entry = await prisma.burndownData.upsert({
      where: { sprintId_date: { sprintId: sprintId as string, date: new Date(date) } },
      create: { sprintId: sprintId as string, date: new Date(date), remaining, ideal },
      update: { remaining, ideal },
    })
    return res.json({ entry })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
