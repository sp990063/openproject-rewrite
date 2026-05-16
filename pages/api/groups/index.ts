import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSystemAdmin } from '@/lib/auth'

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return getGroups(req, res)
    case 'POST':
      return createGroup(req, res)
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getGroups(req: NextApiRequest, res: NextApiResponse) {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(groups)
  } catch (error) {
    console.error('Error fetching groups:', error)
    return res.status(500).json({ error: 'Failed to fetch groups' })
  }
}

async function createGroup(req: NextApiRequest, res: NextApiResponse) {
  try {
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const data = createGroupSchema.parse(req.body)

    const group = await prisma.group.create({
      data: { name: data.name },
    })

    return res.status(201).json(group)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error creating group:', error)
    return res.status(500).json({ error: 'Failed to create group' })
  }
}
