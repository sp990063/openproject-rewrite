import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
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
      return getGroup(req, res, id)
    case 'PUT':
      return updateGroup(req, res, id)
    case 'DELETE':
      return deleteGroup(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getGroup(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const group = await prisma.group.findUnique({
      where: { id },
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

    return res.status(200).json(group)
  } catch (error) {
    console.error('Error fetching group:', error)
    return res.status(500).json({ error: 'Failed to fetch group' })
  }
}

async function updateGroup(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const data = updateGroupSchema.parse(req.body)

    const group = await prisma.group.update({
      where: { id },
      data,
    })

    return res.status(200).json(group)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating group:', error)
    return res.status(500).json({ error: 'Failed to update group' })
  }
}

async function deleteGroup(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await prisma.group.delete({
      where: { id },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting group:', error)
    return res.status(500).json({ error: 'Failed to delete group' })
  }
}
