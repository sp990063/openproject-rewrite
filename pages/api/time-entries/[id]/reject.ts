import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string().min(1),
})

const bodySchema = z.object({
  reason: z.string().max(2000).optional(),
})

/**
 * POST /api/time-entries/[id]/reject
 *
 * Phase 3 Sprint 3 fix — addresses API-80 / API-191.
 *
 * Previously: any authenticated user could reject any submitted time
 * entry. Same CRITICAL RBAC gap as approve.ts (API-78).
 *
 * Now: migrated to `withRoute` HOF, gated by `assertProjectMembership`
 * on the entry's work-package's project.
 */
export default withRoute<
  z.input<typeof bodySchema>,
  unknown,
  z.input<typeof paramsSchema>
>(
  async ({ params, req, res, session, body }) => {
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

    // Project membership gate (API-80).
    await assertProjectMembership(
      existing.workPackage.projectId,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (existing.status !== 'submitted') {
      throw new ApiError(
        400,
        'INVALID_STATUS',
        'You can only reject submitted time entries'
      )
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: body.reason ?? null,
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
    bodySchema,
    auditLog: (ctx) => {
      console.log(
        `[audit] ${ctx.method} ${ctx.path} -> ${ctx.statusCode} (${ctx.duration}ms) user=${ctx.userId} action=TIME_ENTRY_REJECT`
      )
    },
  }
)