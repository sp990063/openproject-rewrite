import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { v3ListResponse, v3Error } from '@/lib/api/v3/response-formatter'

/**
 * OpenProject API v3 - Users list endpoint
 * GET /api/v3/users - List users
 * Supports ?offset=&pageSize=
 *
 * Phase 6 3-angle review P0: added auth gate. Pre-existing route was
 * publicly readable and returned each user's email + isSystemAdmin flag
 * — full PII + admin roster dump to anyone with the URL. Same pattern
 * as the prior Phase 5 fixes (/api/search, /api/time-reports/*, etc.).
 * Restrict to system admin (full PII dump) or any authenticated user
 * (sanitized view without email) — for now we just gate to admin since
 * the v3 response shape is the admin-level PII dump.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(v3Error('methodNotAllowed', `Method ${req.method} not allowed`))
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(v3Error('unauthorized', 'Not authenticated'))
  }
  // Only system admins can list all users with email + isSystemAdmin.
  // The shape is a PII dump — non-admins should hit a sanitized endpoint.
  if (!session.user.isSystemAdmin) {
    return res.status(403).json(v3Error('forbidden', 'Admin only'))
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
