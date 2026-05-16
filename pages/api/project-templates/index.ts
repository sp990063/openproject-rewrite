import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  modules: z.array(z.string()),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) {
    return res.status(403).json({ error: 'Admin only' })
  }

  switch (req.method) {
    case 'GET':
      return getTemplates(req, res)
    case 'POST':
      return createTemplate(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getTemplates(req: NextApiRequest, res: NextApiResponse) {
  try {
    const templates = await prisma.projectTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(templates)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return res.status(500).json({ error: 'Failed to fetch templates' })
  }
}

async function createTemplate(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createTemplateSchema.parse(req.body)

    const template = await prisma.projectTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        modules: data.modules,
      },
    })

    return res.status(201).json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating template:', error)
    return res.status(500).json({ error: 'Failed to create template' })
  }
}
