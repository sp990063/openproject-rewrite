import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

const moduleTypeEnum = z.enum([
  'work_packages',
  'gantt',
  'board',
  'calendar',
  'wiki',
  'forums',
  'documents',
  'meetings',
  'time_tracking',
])

const updateModulesSchema = z.object({
  modules: z.array(
    z.object({
      module: moduleTypeEnum,
      enabled: z.boolean(),
    })
  ),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const projectId = query.id as string

  if (!projectId) {
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
      return getModules(req, res, projectId)
    case 'PATCH':
      return updateModules(req, res, projectId)
    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getModules(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const modules = await prisma.projectModule.findMany({
      where: { projectId },
      orderBy: { module: 'asc' },
    })

    return res.status(200).json(modules)
  } catch (error) {
    console.error('Error fetching project modules:', error)
    return res.status(500).json({ error: 'Failed to fetch project modules' })
  }
}

async function updateModules(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const data = updateModulesSchema.parse(req.body)

    // Upsert each module
    const results = await prisma.$transaction(
      data.modules.map((m) =>
        prisma.projectModule.upsert({
          where: {
            projectId_module: { projectId, module: m.module },
          },
          create: {
            projectId,
            module: m.module,
            enabled: m.enabled,
          },
          update: {
            enabled: m.enabled,
          },
        })
      )
    )

    return res.status(200).json(results)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating project modules:', error)
    return res.status(500).json({ error: 'Failed to update project modules' })
  }
}
