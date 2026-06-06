// pages/api/projects/[projectId]/index.ts
// Phase 0 security fix: PATCH/DELETE previously had no auth at all —
// anyone could rename or permanently delete any project. GET remains
// public-readable (project membership visibility is enforced elsewhere).
// TODO Phase 1: migrate the whole file to withRoute HOF + rbac callback.
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { authOptions } from '@/lib/auth'

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'on_hold', 'archived']).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const projectId = query.projectId as string

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
      return getProject(req, res, projectId)
    case 'PATCH':
      return updateProject(req, res, projectId)
    case 'DELETE':
      return deleteProject(req, res, projectId)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getProject(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
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

async function updateProject(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  // Phase 0: auth + admin RBAC
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!session.user.isSystemAdmin) {
    const member = await prisma.member.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      include: { role: { select: { permissions: true } } },
    })
    if (!member || !member.role.permissions.includes('PROJECT_EDIT')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }
  try {
    const data = updateProjectSchema.parse(req.body)

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
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

    return res.status(200).json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating project:', error)
    return res.status(500).json({ error: 'Failed to update project' })
  }
}

async function deleteProject(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  // Phase 0: auth + admin-only RBAC. Deletion is destructive enough that
  // we require system admin OR an explicit PROJECT_DELETE permission in the
  // project's role configuration.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!session.user.isSystemAdmin) {
    const member = await prisma.member.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      include: { role: { select: { permissions: true } } },
    })
    if (!member || !member.role.permissions.includes('PROJECT_DELETE')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }
  try {
    await prisma.project.delete({ where: { id: projectId } })
    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting project:', error)
    return res.status(500).json({ error: 'Failed to delete project' })
  }
}
