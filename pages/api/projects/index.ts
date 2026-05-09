import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/ratelimit'

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  identifier: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/, 'Identifier must be lowercase alphanumeric with hyphens'),
  moduleTypes: z.array(z.string()).optional(), // default modules to enable; if omitted, all are created
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      return getProjects(req, res)
    case 'POST':
      return createProject(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getProjects(req: NextApiRequest, res: NextApiResponse) {
  try {
    const projects = await prisma.project.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            role: true,
          },
        },
        _count: { select: { workPackages: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return res.status(500).json({ error: 'Failed to fetch projects' })
  }
}

const ALL_MODULES = [
  'work_packages',
  'gantt',
  'board',
  'calendar',
  'wiki',
  'forums',
  'documents',
  'meetings',
  'time_tracking',
]

async function createProject(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = createProjectSchema.parse(req.body)

    // Check if identifier already exists
    const existing = await prisma.project.findUnique({
      where: { identifier: data.identifier },
    })
    if (existing) {
      return res.status(400).json({ error: 'Project identifier already exists' })
    }

    const moduleTypes = data.moduleTypes ?? ALL_MODULES

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        identifier: data.identifier,
        modules: {
          create: moduleTypes.map((module) => ({
            module,
            enabled: true,
          })),
        },
      },
      include: {
        modules: true,
      },
    })

    return res.status(201).json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating project:', error)
    return res.status(500).json({ error: 'Failed to create project' })
  }
}
