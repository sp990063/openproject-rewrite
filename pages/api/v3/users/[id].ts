import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { v3Error } from '@/lib/api/v3/response-formatter'

/**
 * OpenProject API v3 - Single user endpoint
 * GET /api/v3/users/[id]
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json(v3Error('BadRequest', 'User ID is required'))
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(v3Error('methodNotAllowed', `Method ${req.method} not allowed`))
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isSystemAdmin: true,
        passwordMigrationRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json(v3Error('NotFound', 'User not found'))
    }

    // Format in OpenProject API v3 style
    const formattedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _type: 'User',
      _links: {
        self: { href: `/api/v3/users/${user.id}` },
        lockUser: { href: `/api/v3/users/${user.id}/lock`, method: 'POST' },
        delete: { href: `/api/v3/users/${user.id}`, method: 'DELETE' },
      },
      ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
      ...(user.isSystemAdmin && { isAdmin: true }),
    }

    return res.status(200).json(formattedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to fetch user'))
  }
}
