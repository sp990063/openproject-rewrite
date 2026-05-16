import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { v3ListResponse, v3Error } from '@/lib/api/v3/response-formatter'

/**
 * OpenProject API v3 - Users list endpoint
 * GET /api/v3/users - List users
 * Supports ?offset=&pageSize=
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(v3Error('methodNotAllowed', `Method ${req.method} not allowed`))
  }

  try {
    // Parse pagination params
    const offset = Math.max(1, parseInt(req.query.offset as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    // Get total count
    const total = await prisma.user.count()

    // Fetch users with pagination
    const users = await prisma.user.findMany({
      skip: offset - 1,
      take: pageSize,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    })

    // Format in OpenProject API v3 style
    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      _type: 'User',
      _links: {
        self: { href: `/api/v3/users/${user.id}` },
        lockUser: { href: `/api/v3/users/${user.id}/lock`, method: 'POST' },
        delete: { href: `/api/v3/users/${user.id}`, method: 'DELETE' },
      },
      ...(user.avatarUrl && { avatarUrl: user.avatarUrl }),
      ...(user.isSystemAdmin && { isAdmin: true }),
    }))

    const response = v3ListResponse(formattedUsers, total, offset, pageSize)
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to fetch users'))
  }
}
