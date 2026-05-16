
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createBudgetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().min(0).default(0),
})


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { projectId } = req.query
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Invalid projectId' })
  }

  // GET /api/projects/[projectId]/budgets — list budgets for project
  if (req.method === 'GET') {
    const budgets = await prisma.budget.findMany({
      where: { projectId },
      include: {
        lines: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ budgets })
  }

  // POST /api/projects/[projectId]/budgets — create budget
  if (req.method === 'POST') {
    const parsed = createBudgetSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const budget = await prisma.budget.create({
      data: {
        projectId,
        name: parsed.data.name,
        description: parsed.data.description,
        amount: parsed.data.amount,
      },
      include: {
        lines: true,
        project: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json({ budget })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}