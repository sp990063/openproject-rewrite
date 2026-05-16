import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { projectId, id } = req.query
  if (!projectId || !id) return res.status(400).json({ error: 'Missing projectId or id' })

  if (req.method === 'GET') {
    const budget = await prisma.budget.findUnique({ where: { id: id as string } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })
    if (budget.projectId !== projectId) return res.status(403).json({ error: 'Forbidden' })

    // Calculate actual cost from time entries linked to this project's work packages
    const timeEntries = await prisma.timeEntry.findMany({
      where: { projectId: projectId as string },
      include: { activity: true },
    })

    const actualCost = timeEntries.reduce((sum, te) => {
      const rate = (te as any).activity?.hourlyRate || 0
      return sum + (te.hours || 0) * rate
    }, 0)

    // Calculate planned cost from budget lines
    const budgetLines = await prisma.budgetLine.findMany({
      where: { budgetId: id as string },
    })

    const plannedFromLines = budgetLines.reduce((sum, line) => sum + (line.totalCost || 0), 0)

    return res.json({
      budgetId: id,
      planned: budget.amount,
      plannedFromLines,
      actualCost,
      variance: budget.amount - actualCost,
      timeEntryCount: timeEntries.length,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
