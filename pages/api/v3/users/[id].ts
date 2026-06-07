import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { v3Error } from '@/lib/api/v3/response-formatter'

/**
 * OpenProject API v3 - Single user endpoint
 * GET /api/v3/users/[id]
 *
 * Phase 6 3-angle review P0: added auth gate. Pre-existing route was
 * publicly readable and returned each user's email + isSystemAdmin +
 * passwordMigrationRequired — full PII dump to anyone with the URL.
 * The `passwordMigrationRequired` flag is particularly sensitive: it
 * tells an attacker exactly which users can be phished for a password
 * reset. Same pattern as the prior Phase 5 fixes. Restrict to
 * (a) the user themselves, (b) system admin, or (c) project members
 * of a project where the target is also a member (visible-only).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json(v3Error('BadRequest', 'User ID is required'))
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(v3Error('unauthorized', 'Not authenticated'))
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

    // Authorization: viewer is the target themselves, a system admin,
    // or shares a project with the target. Non-authorized viewers get
    // a 403 — not a 404 — so the existence of the user is still
    // discoverable (acceptable for an internal app).
    const isSelf = session.user.id === user.id
    const isAdmin = session.user.isSystemAdmin === true
    let sharesProject = false
    if (!isSelf && !isAdmin) {
      const shared = await prisma.member.findFirst({
        where: {
          userId: session.user.id,
          project: {
            members: { some: { userId: user.id } },
          },
        },
        select: { id: true },
      })
      sharesProject = !!shared
    }
    if (!isSelf && !isAdmin && !sharesProject) {
      return res.status(403).json(v3Error('forbidden', 'Not authorized to view this user'))
    }

    // Format in OpenProject API v3 style. Hide the passwordMigrationRequired
    // flag for non-self viewers (admins can still see it via direct DB).
    const showMigrationFlag = isSelf || isAdmin
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
      ...(showMigrationFlag && { passwordMigrationRequired: user.passwordMigrationRequired }),
    }

    return res.status(200).json(formattedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to fetch user'))
  }
}
