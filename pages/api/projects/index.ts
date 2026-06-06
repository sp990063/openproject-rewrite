// pages/api/projects/index.ts
// Refactored to use withRoute HOF (Phase 1 of migration plan)
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  identifier: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-_]+$/, 'Identifier must be lowercase alphanumeric with hyphens'),
  moduleTypes: z.array(z.string()).optional(),
})

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

export default withRoute<z.infer<typeof createProjectSchema>, unknown, unknown>(
  async ({ req, res, session, body }) => {
    // GET /api/projects — list all visible projects
    if (req.method === 'GET') {
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
      return res.status(200).json({ success: true, data: projects })
    }

    // POST /api/projects — create a new project
    if (req.method === 'POST') {
      // Only system admins may create projects
      if (!session.user.isSystemAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'System admin required to create projects')
      }

      const existing = await prisma.project.findUnique({
        where: { identifier: body.identifier },
      })
      if (existing) {
        throw new ApiError(409, 'PROJECT_EXISTS', 'Project identifier already exists')
      }

      const moduleTypes = body.moduleTypes ?? ALL_MODULES
      const project = await prisma.project.create({
        data: {
          name: body.name,
          description: body.description,
          identifier: body.identifier,
          modules: {
            create: moduleTypes.map((module) => ({ module, enabled: true })),
          },
        },
        include: { modules: true },
      })
      return res.status(201).json({ success: true, data: project })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createProjectSchema,
    // Only POST bodies are validated by bodySchema; GET has no body.
    // We do our own per-method dispatch inside the handler so GET requests
    // don't get hit by a 500 when the body is undefined.
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
