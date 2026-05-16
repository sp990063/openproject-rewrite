import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'

const addMemberSchema = z.object({
  userId: z.string(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Group ID is required' })
  }

  switch (req.method) {
    case 'GET':
      return getMembers(req, res, id)
    case 'POST':
      return addMember(req, res, id)
    case 'DELETE':
      return removeMember(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getMembers(req: NextApiRequest, res: NextApiResponse, groupId: string) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })

    if (!group) {
      return res.status(404).json({ error: 'Group not found' })
    }

    return res.status(200).json(group.members)
  } catch (error) {
    console.error('Error fetching members:', error)
    return res.status(500).json({ error: 'Failed to fetch members' })
  }
}

async function addMember(req: NextApiRequest, res: NextApiResponse, groupId: string) {
  try {
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const data = addMemberSchema.parse(req.body)

    // Check if group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } })
    if (!group) {
      return res.status(404).json({ error: 'Group not found' })
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const membership = await prisma.groupMembership.create({
      data: {
        groupId,
        userId: data.userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    return res.status(201).json(membership)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    // Handle unique constraint violation
    if ((error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'User is already a member of this group' })
    }
    console.error('Error adding member:', error)
    return res.status(500).json({ error: 'Failed to add member' })
  }
}

async function removeMember(req: NextApiRequest, res: NextApiResponse, groupId: string) {
  try {
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { userId } = req.query
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' })
    }

    await prisma.groupMembership.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error removing member:', error)
    return res.status(500).json({ error: 'Failed to remove member' })
  }
}
