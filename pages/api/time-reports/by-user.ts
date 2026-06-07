import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
  }

  // Phase 5 Sprint 1: auth gate (was missing — would leak all time entries
  // to any unauthenticated caller). Restrict to: (a) self, (b) project members
  // whose projectId was supplied, (c) admins. Anonymous callers get 401.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'))
  }
  const viewerId = session.user.id

  try {
    const { userId, projectId, from, to, includeDeleted } = req.query

    // Authorization: if the caller is asking about a specific user, they must
    // be either that user, a system admin, or a project member when projectId
    // is also supplied.
    if (userId && typeof userId === 'string' && userId !== viewerId) {
      const isAdmin = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { isSystemAdmin: true },
      }).then((u) => u?.isSystemAdmin === true)
      if (!isAdmin) {
        // Allow if they're a member of the filtered project
        if (projectId && typeof projectId === 'string') {
          const membership = await prisma.member.findFirst({
            where: { projectId, userId: viewerId },
            select: { id: true },
          })
          if (!membership) {
            return res.status(403).json(errorResponse('FORBIDDEN', 'Cannot view another user\'s time report'))
          }
        } else {
          return res.status(403).json(errorResponse('FORBIDDEN', 'Cannot view another user\'s time report'))
        }
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {}

    // Exclude soft-deleted entries by default (M2 fix)
    if (includeDeleted !== 'true') {
      where.deletedAt = null
    }

    if (userId) where.userId = userId as string

    // Date range filter on spentOn
    if (from || to) {
      where.spentOn = {}
      if (from) (where.spentOn as Record<string, unknown>).gte = new Date(from as string)
      if (to) (where.spentOn as Record<string, unknown>).lte = new Date(to as string)
    }

    // If projectId is provided, filter via workPackage relation
    if (projectId) {
      where.workPackage = { projectId: projectId as string }
    }

    // Get all time entries grouped by user and project
    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        workPackage: {
          select: {
            id: true,
            subject: true,
            estimatedHours: true,
            project: { select: { id: true, name: true } }
          }
        },
        user: { select: { id: true, name: true } },
      },
      orderBy: { spentOn: 'desc' },
    })

    // Group by userId and projectId
    const reportByUser: Record<string, {
      userId: string
      userName: string
      projectId: string
      projectName: string
      totalHours: number
      entries: typeof entries
    }> = {}

    for (const entry of entries) {
      const projectId = entry.workPackage?.project?.id ?? 'unknown'
      const projectName = entry.workPackage?.project?.name ?? 'Unknown Project'
      const userId = entry.userId
      const userName = entry.user?.name ?? 'Unknown User'
      const key = `${userId}-${projectId}`

      if (!reportByUser[key]) {
        reportByUser[key] = {
          userId,
          userName,
          projectId,
          projectName,
          totalHours: 0,
          entries: [],
        }
      }

      reportByUser[key].totalHours += entry.hours
      reportByUser[key].entries.push(entry)
    }

    const report = Object.values(reportByUser).map((group) => ({
      userId: group.userId,
      userName: group.userName,
      projectId: group.projectId,
      projectName: group.projectName,
      totalHours: group.totalHours,
      entries: group.entries.map((entry) => ({
        ...entry,
        spentOn: entry.spentOn.toISOString(),
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        deletedAt: entry.deletedAt?.toISOString() ?? null,
      })),
    }))

    return res.status(200).json(successResponse({ report }))
  } catch (error) {
    console.error('Error fetching time report by user:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch time report'))
  }
}
