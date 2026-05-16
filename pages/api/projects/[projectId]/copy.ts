import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'

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

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  return copyProject(req, res, id)
}

async function copyProject(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    // Auth check
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Fetch the original project with all related data
    const originalProject = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            role: true,
          },
        },
        versions: true,
        modules: true,
      },
    })

    if (!originalProject) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Generate a new identifier for the copied project
    const baseIdentifier = `${originalProject.identifier}-copy`
    let newIdentifier = baseIdentifier
    let counter = 1

    // Check for existing identifier and increment if needed
    while (await prisma.project.findUnique({ where: { identifier: newIdentifier } })) {
      counter++
      newIdentifier = `${baseIdentifier}-${counter}`
    }

    // Create the copied project with all related data in a transaction
    const copiedProject = await prisma.$transaction(async (tx) => {
      // Create the new project
      const newProject = await tx.project.create({
        data: {
          name: `${originalProject.name} (Copy)`,
          description: originalProject.description,
          identifier: newIdentifier,
          status: 'active',
        },
      })

      // Copy versions
      if (originalProject.versions.length > 0) {
        await tx.version.createMany({
          data: originalProject.versions.map((version) => ({
            projectId: newProject.id,
            name: version.name,
            status: version.status,
            dueDate: version.dueDate,
          })),
        })
      }

      // Copy modules
      if (originalProject.modules.length > 0) {
        await tx.projectModule.createMany({
          data: originalProject.modules.map((module) => ({
            projectId: newProject.id,
            module: module.module,
            enabled: module.enabled,
          })),
        })
      }

      // Copy members with the same roles
      if (originalProject.members.length > 0) {
        await tx.member.createMany({
          data: originalProject.members.map((member) => ({
            projectId: newProject.id,
            userId: member.userId,
            roleId: member.roleId,
          })),
        })
      }

      return newProject
    })

    return res.status(201).json({ id: copiedProject.id })
  } catch (error) {
    console.error('Error copying project:', error)
    return res.status(500).json({ error: 'Failed to copy project' })
  }
}
