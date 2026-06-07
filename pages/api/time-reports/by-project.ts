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

  // Phase 5 Sprint 1: auth gate (was missing — would leak all per-project
  // time entries to any unauthenticated caller). Require auth + membership
  // on the queried project. Admins bypass membership.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'))
  }
  const viewerId = session.user.id

  try {
    const { projectId, userId, from, to, includeDeleted } = req.query

    // Authorization: caller must be a member of the queried project (or admin).
    if (projectId && typeof projectId === 'string') {
      const isAdmin = await prisma.user.findUnique({
        where: { id: viewerId },
        select: { isSystemAdmin: true },
      }).then((u) => u?.isSystemAdmin === true)
      if (!isAdmin) {
        const membership = await prisma.member.findFirst({
          where: { projectId, userId: viewerId },
          select: { id: true },
        })
        if (!membership) {
          return res.status(403).json(errorResponse('FORBIDDEN', 'Not a member of this project'))
        }
      }
    }

    // Build where clause
    const where: Record<string, unknown> = {}

    // Exclude soft-deleted entries by default (M2 fix)
    if (includeDeleted !== 'true') {
      where.deletedAt = null
    }

    if (projectId) where.workPackage = { projectId: projectId as string }
    if (userId) where.userId = userId as string

    // Date range filter on spentOn
    if (from || to) {
      where.spentOn = {}
      if (from) (where.spentOn as Record<string, unknown>).gte = new Date(from as string)
      if (to) (where.spentOn as Record<string, unknown>).lte = new Date(to as string)
    }

    // Get all time entries grouped by work package
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

    // Group by workPackageId
    const reportByWorkPackage: Record<string, {
      workPackageId: string
      workPackageSubject: string
      projectId: string
      projectName: string
      estimatedHours: number | null
      totalHours: number
      entries: typeof entries
    }> = {}

    for (const entry of entries) {
      const workPackageId = entry.workPackageId
      const workPackageSubject = entry.workPackage?.subject ?? 'Unknown'
      const projectId = entry.workPackage?.project?.id ?? 'unknown'
      const projectName = entry.workPackage?.project?.name ?? 'Unknown Project'
      const estimatedHours = entry.workPackage?.estimatedHours ?? null

      if (!reportByWorkPackage[workPackageId]) {
        reportByWorkPackage[workPackageId] = {
          workPackageId,
          workPackageSubject,
          projectId,
          projectName,
          estimatedHours,
          totalHours: 0,
          entries: [],
        }
      }

      reportByWorkPackage[workPackageId].totalHours += entry.hours
      reportByWorkPackage[workPackageId].entries.push(entry)
    }

    const report = Object.values(reportByWorkPackage).map((group) => ({
      workPackageId: group.workPackageId,
      workPackageSubject: group.workPackageSubject,
      projectId: group.projectId,
      projectName: group.projectName,
      estimatedHours: group.estimatedHours,
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
    console.error('Error fetching time report by project:', error)
    return res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch time report'))
  }
}
