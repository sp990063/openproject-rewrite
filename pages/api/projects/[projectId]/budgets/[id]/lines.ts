
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createLineSchema = z.object({
  description: z.string().min(1),
  unitCost: z.number().min(0).default(0),
  quantity: z.number().min(0).default(1),
  workPackageId: z.string().optional().nullable(),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId, id } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid budget id' })
  }

  // GET /api/projects/[projectId]/budgets/[id]/lines — get lines for budget
  if (req.method === 'GET') {
    const budget = await prisma.budget.findFirst({
      where: { id, projectId },
      include: { lines: { include: { workPackage: { select: { id: true, subject: true } } } } },
    })
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' })
    }
    return res.json({ lines: budget.lines })
  }

  // POST /api/projects/[projectId]/budgets/[id]/lines — add line to budget
  if (req.method === 'POST') {
    const budget = await prisma.budget.findFirst({
      where: { id, projectId },
    })
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' })
    }

    const parsed = createLineSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const { description, unitCost, quantity, workPackageId } = parsed.data
    const totalCost = unitCost * quantity

    const line = await prisma.budgetLine.create({
      data: {
        budgetId: id,
        description,
        unitCost,
        quantity,
        totalCost,
        workPackageId: workPackageId || null,
      },
      include: {
        workPackage: { select: { id: true, subject: true } },
      },
    })

    return res.status(201).json({ line })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}