// pages/api/work-packages/[id]/time-entries.ts
// Phase 7 Sprint A2: refactored to withRoute HOF + project-membership RBAC
// (was: direct handler with getServerSession+401, see Phase 7 Sprint A1
// 050bdbc for the auth-only fix). Behavior change vs A1:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check (NEW: was 200 with data)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute } from '@/lib/api/withRoute'
import { assertWorkPackageViewPermission } from '@/lib/auth/workPackage'

export default withRoute(
  async ({ req, res, session, query }) => {
    const id = query.id as string
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Work package ID is required' },
      })
    }

    // RBAC: user must be a project member (or system admin) to see time entries
    await assertWorkPackageViewPermission(id, session.user.id, !!session.user.isSystemAdmin)

    const { includeDeleted } = req.query

    // Build where clause
    const where: Record<string, unknown> = {
      workPackageId: id,
    }

    // Exclude soft-deleted entries by default (M2 fix)
    if (includeDeleted !== 'true') {
      where.deletedAt = null
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true },
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { spentOn: 'desc' },
    })

    // Compute overtimeHours warning if hours > estimatedHours * 1.2
    const entriesWithOvertime = entries.map((entry) => {
      const estimatedHours = entry.workPackage?.estimatedHours
      let overtimeHours: number | null = null

      if (estimatedHours && entry.hours > estimatedHours * 1.2) {
        overtimeHours = entry.hours - estimatedHours
      }

      return {
        ...entry,
        spentOn: entry.spentOn.toISOString(),
        approvedAt: entry.approvedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        deletedAt: entry.deletedAt?.toISOString() ?? null,
        overtimeHours,
      }
    })

    return res.status(200).json({
      success: true,
      data: { entries: entriesWithOvertime },
    })
  },
  {
    methods: ['GET'],
  }
)
