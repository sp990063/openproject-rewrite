import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { v3ListResponse, v3Error } from '@/lib/api/v3/response-formatter'
import { validateApiKey } from '@/lib/api/v3/auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Parse filter query param format: filters=[{field:{operator:value}}]
 * Simplified filter parsing for OpenProject API v3 compatibility
 */
function parseFilters(filtersParam: string | string[] | undefined): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (!filtersParam) return where

  try {
    const filtersStr = Array.isArray(filtersParam) ? filtersParam[0] : filtersParam
    const filters = JSON.parse(filtersStr)

    if (Array.isArray(filters)) {
      for (const filter of filters) {
        for (const [field, condition] of Object.entries(filter)) {
          const cond = condition as { operator?: string; values?: string[] }
          if (cond.operator && cond.values) {
            switch (cond.operator) {
              case '=':
                where[field] = cond.values[0]
                break
              case '!':
                where[field] = { not: cond.values[0] }
                break
              case '>':
                where[field] = { gt: cond.values[0] }
                break
              case '<':
                where[field] = { lt: cond.values[0] }
                break
              case '~':
                // Contains (case-insensitive)
                where[field] = { contains: cond.values[0], mode: 'insensitive' }
                break
            }
          }
        }
      }
    }
  } catch {
    // Invalid filter format, ignore
  }

  return where
}

/**
 * OpenProject API v3 - Work Packages endpoint
 * GET /api/v3/work_packages - List work packages
 * Supports ?offset=&pageSize=&filters=[{field:{operator:value}}]
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

    // Parse filters
    const filters = parseFilters(req.query.filters as string)

    // Build where clause
    const where: Record<string, unknown> = {}
    if (filters.statusId) where.statusId = filters.statusId
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.assigneeId) where.assigneeId = filters.assigneeId
    if (filters.typeId) where.typeId = filters.typeId
    if (filters.priorityId) where.priorityId = filters.priorityId

    // Get total count
    const total = await prisma.workPackage.count({ where })

    // Fetch work packages with pagination
    const workPackages = await prisma.workPackage.findMany({
      where,
      skip: offset - 1,
      take: pageSize,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: {
        project: { select: { id: true, name: true, identifier: true } },
        status: true,
        type: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        author: { select: { id: true, name: true, email: true } },
      },
    })

    // Format in OpenProject API v3 style
    const formattedWorkPackages = workPackages.map((wp) => ({
      id: wp.id,
      subject: wp.subject,
      description: wp.description,
      startDate: wp.startDate,
      dueDate: wp.dueDate,
      estimatedHours: wp.estimatedHours,
      position: wp.position,
      storyPoints: wp.storyPoints,
      createdAt: wp.createdAt,
      updatedAt: wp.updatedAt,
      _type: 'WorkPackage',
      _links: {
        self: { href: `/api/v3/work-packages/${wp.id}` },
        project: { href: `/api/v3/projects/${wp.projectId}`, title: wp.project.name },
        status: { href: `/api/v3/statuses/${wp.statusId}`, title: wp.status.name },
        type: { href: `/api/v3/types/${wp.typeId}`, title: wp.type.name },
        priority: { href: `/api/v3/priorities/${wp.priorityId}`, title: wp.priority.name },
        assignee: wp.assignee
          ? { href: `/api/v3/users/${wp.assigneeId}`, title: wp.assignee.name }
          : null,
        author: { href: `/api/v3/users/${wp.authorId}`, title: wp.author.name },
      },
      _embedded: {
        project: {
          id: wp.project.id,
          name: wp.project.name,
          identifier: wp.project.identifier,
          _links: { self: { href: `/api/v3/projects/${wp.project.id}` } },
        },
        status: {
          id: wp.status.id,
          name: wp.status.name,
          color: wp.status.color,
          isClosed: wp.status.isClosed,
          _links: { self: { href: `/api/v3/statuses/${wp.status.id}` } },
        },
        type: {
          id: wp.type.id,
          name: wp.type.name,
          color: wp.type.color,
          isMilestone: wp.type.isMilestone,
          _links: { self: { href: `/api/v3/types/${wp.type.id}` } },
        },
        priority: {
          id: wp.priority.id,
          name: wp.priority.name,
          color: wp.priority.color,
          _links: { self: { href: `/api/v3/priorities/${wp.priority.id}` } },
        },
        assignee: wp.assignee
          ? {
              id: wp.assignee.id,
              name: wp.assignee.name,
              _links: { self: { href: `/api/v3/users/${wp.assignee.id}` } },
            }
          : null,
        author: {
          id: wp.author.id,
          name: wp.author.name,
          _links: { self: { href: `/api/v3/users/${wp.author.id}` } },
        },
      },
    }))

    const response = v3ListResponse(formattedWorkPackages, total, offset, pageSize)
    return res.status(200).json(response)
  } catch (error) {
    console.error('Error fetching work packages:', error)
    return res.status(500).json(v3Error('InternalError', 'Failed to fetch work packages'))
  }
}
