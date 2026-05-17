import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { emitActivity } from '@/lib/activity'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const createMemberSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
})

const updateMemberSchema = z.object({
  roleId: z.string().min(1).optional(),
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
      return getMembers(req, res, projectId)
    case 'POST':
      return addMember(req, res, projectId)
    case 'PATCH':
      return updateMember(req, res, projectId)
    case 'DELETE':
      return removeMember(req, res, projectId)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getMembers(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const members = await prisma.member.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return res.status(200).json(members)
  } catch (error) {
    console.error('Error fetching project members:', error)
    return res.status(500).json({ error: 'Failed to fetch project members' })
  }
}

async function addMember(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const data = createMemberSchema.parse(req.body)

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      return res.status(400).json({ error: 'User not found' })
    }

    // Check if role exists
    const role = await prisma.role.findUnique({ where: { id: data.roleId } })
    if (!role) {
      return res.status(400).json({ error: 'Role not found' })
    }

    // Check for duplicate membership
    const existing = await prisma.member.findUnique({
      where: { userId_projectId: { userId: data.userId, projectId } },
    })
    if (existing) {
      return res.status(400).json({ error: 'User is already a member of this project' })
    }

    const member = await prisma.member.create({
      data: {
        userId: data.userId,
        projectId,
        roleId: data.roleId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: true,
      },
    })

    // Fetch user name for activity reference
    const addedUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { name: true },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'member',
      subjectId: member.id,
      action: 'added',
      reference: { type: 'member', id: member.id, subject: addedUser?.name ?? data.userId },
    })

    return res.status(201).json(member)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error adding project member:', error)
    return res.status(500).json({ error: 'Failed to add project member' })
  }
}

async function updateMember(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const data = updateMemberSchema.parse(req.body)

    // Extract memberId from query
    const memberId = req.query.memberId as string
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
    })
    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }
    if (member.projectId !== projectId) {
      return res.status(400).json({ error: 'Member does not belong to this project' })
    }

    if (data.roleId) {
      const role = await prisma.role.findUnique({ where: { id: data.roleId } })
      if (!role) {
        return res.status(400).json({ error: 'Role not found' })
      }
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: {
        roleId: data.roleId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: true,
      },
    })

    return res.status(200).json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating project member:', error)
    return res.status(500).json({ error: 'Failed to update project member' })
  }
}

async function removeMember(req: NextApiRequest, res: NextApiResponse, projectId: string) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const memberId = req.query.memberId as string
    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
    })
    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }
    if (member.projectId !== projectId) {
      return res.status(400).json({ error: 'Member does not belong to this project' })
    }

    await prisma.member.delete({ where: { id: memberId } })

    // Fetch user name for activity reference
    const removedUser = await prisma.user.findUnique({
      where: { id: member.userId },
      select: { name: true },
    })

    await emitActivity({
      projectId,
      userId: session.user.id,
      subjectType: 'member',
      subjectId: memberId,
      action: 'removed',
      reference: { type: 'member', id: memberId, subject: removedUser?.name ?? member.userId },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error removing project member:', error)
    return res.status(500).json({ error: 'Failed to remove project member' })
  }
}
