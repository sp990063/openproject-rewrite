import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string().min(1),
})

/**
 * POST /api/time-entries/[id]/approve
 *
 * Phase 3 Sprint 3 fix — addresses API-78 / API-80.
 *
 * Previously: any authenticated user could approve any submitted time
 * entry (the file's own comment admitted "should be restricted by
 * project membership"). Unrestricted approval of payroll/timesheet
 * data — CRITICAL RBAC gap.
 *
 * Now: migrated to `withRoute` HOF, gated by `assertProjectMembership`
 * on the entry's work-package's project. The user must be a member of
 * the project (or a system admin) to approve the entry.
 */
export default withRoute<unknown, unknown, z.input<typeof paramsSchema>>(
  async ({ params, req, res, session }) => {
    const { id } = params

    // Fetch the entry (need projectId via workPackage for membership check)
    const existing = await prisma.timeEntry.findUnique({
      where: { id },
      include: {
        workPackage: { select: { projectId: true } },
      },
    })
    if (!existing) {
      throw new ApiError(404, 'TIME_ENTRY_NOT_FOUND', 'Time entry not found')
    }

    // Project membership gate (API-78). Resolve the entry's project
    // via workPackage.projectId, then assert membership. System admins
    // bypass the check.
    await assertProjectMembership(
      existing.workPackage.projectId,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (existing.status !== 'submitted') {
      throw new ApiError(
        400,
        'INVALID_STATUS',
        'You can only approve submitted time entries'
      )
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
      include: {
        workPackage: {
          select: { id: true, subject: true, estimatedHours: true },
        },
        user: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    })

    const entryWithStrings = {
      ...entry,
      spentOn: entry.spentOn.toISOString(),
      approvedAt: entry.approvedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      deletedAt: entry.deletedAt?.toISOString() ?? null,
    }

    return res.status(200).json({
      success: true,
      data: { entry: entryWithStrings },
    })
  },
  {
    methods: ['POST'],
    paramsSchema,
    // Audit log entry written with a security-relevant action tag.
    auditLog: (ctx) => {
      console.log(
        `[audit] ${ctx.method} ${ctx.path} -> ${ctx.statusCode} (${ctx.duration}ms) user=${ctx.userId} action=TIME_ENTRY_APPROVE`
      )
    },
  }
)