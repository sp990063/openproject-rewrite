import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  modules: z.array(z.string()).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) {
    return res.status(403).json({ error: 'Admin only' })
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Template ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getTemplate(req, res, id)
    case 'PUT':
    case 'PATCH':
      return updateTemplate(req, res, id)
    case 'DELETE':
      return deleteTemplate(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getTemplate(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const template = await prisma.projectTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    return res.status(200).json(template)
  } catch (error) {
    console.error('Error fetching template:', error)
    return res.status(500).json({ error: 'Failed to fetch template' })
  }
}

async function updateTemplate(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateTemplateSchema.parse(req.body)

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.modules !== undefined && { modules: data.modules }),
      },
    })

    return res.status(200).json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating template:', error)
    return res.status(500).json({ error: 'Failed to update template' })
  }
}

async function deleteTemplate(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await prisma.projectTemplate.delete({
      where: { id },
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return res.status(500).json({ error: 'Failed to delete template' })
  }
}
