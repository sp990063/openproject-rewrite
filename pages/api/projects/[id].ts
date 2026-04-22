import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'archived', 'on_hold']).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Project ID is required' })
  }

  // Rate limiting for write methods (skip in test environment)
  if (process.env.NODE_ENV !== 'test' && req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  switch (req.method) {
    case 'GET':
      return getProject(req, res, id)
    case 'PATCH':
      return updateProject(req, res, id)
    case 'DELETE':
      return deleteProject(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getProject(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            role: true,
          },
        },
        versions: true,
        modules: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    return res.status(200).json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return res.status(500).json({ error: 'Failed to fetch project' })
  }
}

async function updateProject(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const data = updateProjectSchema.parse(req.body)

    const project = await prisma.project.update({
      where: { id },
      data,
    })

    return res.status(200).json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating project:', error)
    return res.status(500).json({ error: 'Failed to update project' })
  }
}

async function deleteProject(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    await prisma.project.delete({
      where: { id },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting project:', error)
    return res.status(500).json({ error: 'Failed to delete project' })
  }
}
