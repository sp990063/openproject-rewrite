import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { v3ListResponse, v3Error } from '@/lib/api/v3/response-formatter'
import { validateApiKey } from '@/lib/api/v3/auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * OpenProject API v3 - Projects endpoint
 * GET /api/v3/projects - List projects
 * Supports ?offset=&pageSize= pagination
 * Supports Authorization: Bearer <apikey> header
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(v3Error('methodNotAllowed', `Method ${req.method} not allowed`))
  }

  // Auth: Accept either session or API key
  const session = await getServerSession(req, res, authOptions)
  const apiAuth = await validateApiKey(req)

  if (!session?.user?.id && !apiAuth.userId) {
    return res.status(401).json(v3Error('Unauthorized', 'Authentication required (session or API key)'))
  }

  try {
    // Parse pagination params
    const offset = Math.max(1, parseInt(req.query.offset as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    // Get total count
    const total = await prisma.project.count()

    // Fetch projects with pagination
    const projects = await prisma.project.findMany({
      skip: offset - 1,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
    })

    // Format in OpenProject API v3 style
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      description: project.description,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      _type: 'Project',
      _links: {
        self: { href: `/api/v3/projects/${project.id}` },
        memberships: { href: `/api/v3/projects/${project.id}/memberships` },
      },
      _embedded: {
        members: project.members.map((m) => ({
          id: m.id,
          user: {
            id: m.user.id,
            name: m.user.name,
            _links: { self: { href: `/api/v3/users/${m.user.id}` } },
          },
          role: { id: m.role.id, name: m.role.name },
        })),
      },
    }))

    const response = v3ListResponse(formattedProjects, total, offset, pageSize)
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to fetch projects'))
  }
}
