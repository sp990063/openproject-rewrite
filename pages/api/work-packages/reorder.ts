// pages/api/work-packages/reorder.ts
// Phase 0 refactor: migrate to withRoute HOF — the previous implementation
// had no session check at the route level and relied on
// requireWorkPackagePermission() which itself uses the unreliable
// 1-arg getServerSession() form. Now: route is auth-gated by withRoute
// (session.user.id guaranteed), and the permission check uses the
// session.user.id we already have in scope — no nested getServerSession call.
//
// Phase 7 Sprint A2: assertWorkPackageEditPermission moved to
// lib/auth/workPackage.ts so it can be shared with
// pages/api/work-packages/[id]/activities.ts, relations.ts, and
// time-entries.ts. Behavior identical — same query, same error.
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertWorkPackageEditPermission } from '@/lib/auth/workPackage'

const reorderSchema = z.object({
  workPackageId: z.string().cuid(),
  targetStatusId: z.string().cuid(),
  position: z.number().int().min(0),
})

export default withRoute<z.infer<typeof reorderSchema>, unknown, unknown>(
  async ({ req, res, session, body }) => {
    const { workPackageId, targetStatusId, position: rawPosition } = body

    await assertWorkPackageEditPermission(
      workPackageId,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    const wp = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      select: { id: true, projectId: true, statusId: true, position: true },
    })
    if (!wp) {
      throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
    }

    const targetStatus = await prisma.status.findUnique({
      where: { id: targetStatusId },
      select: { id: true },
    })
    if (!targetStatus) {
      throw new ApiError(404, 'STATUS_NOT_FOUND', 'Status not found')
    }

    const columnCount = await prisma.workPackage.count({
      where: { projectId: wp.projectId, statusId: targetStatusId },
    })

    const targetPosition = Math.max(0, Math.min(rawPosition, columnCount))

    // No-op: same status + same position
    if (wp.statusId === targetStatusId && wp.position === targetPosition) {
      const currentColumn = await prisma.workPackage.findMany({
        where: { projectId: wp.projectId, statusId: targetStatusId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      })
      return res.status(200).json({
        success: true,
        data: {
          workPackage: { id: wp.id, position: wp.position, statusId: wp.statusId },
          column: { statusId: targetStatusId, workPackages: currentColumn },
        },
      })
    }

    const oldStatusId = wp.statusId
    const oldPosition = wp.position
    const isMovingToNewColumn = oldStatusId !== targetStatusId

    const result = await prisma.$transaction(async (tx) => {
      if (isMovingToNewColumn) {
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: oldStatusId,
            position: { gt: oldPosition },
          },
          data: { position: { decrement: 1 } },
        })
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: targetStatusId,
            position: { gte: targetPosition },
          },
          data: { position: { increment: 1 } },
        })
      } else {
        if (oldPosition > targetPosition) {
          await tx.workPackage.updateMany({
            where: {
              projectId: wp.projectId,
              statusId: oldStatusId,
              position: { gte: targetPosition, lt: oldPosition },
              id: { not: workPackageId },
            },
            data: { position: { increment: 1 } },
          })
        } else {
          await tx.workPackage.updateMany({
            where: {
              projectId: wp.projectId,
              statusId: oldStatusId,
              position: { gt: oldPosition, lte: targetPosition },
              id: { not: workPackageId },
            },
            data: { position: { decrement: 1 } },
          })
        }
      }

      const updatedWp = await tx.workPackage.update({
        where: { id: workPackageId },
        data: { statusId: targetStatusId, position: targetPosition },
        select: { id: true, position: true, statusId: true },
      })

      const column = await tx.workPackage.findMany({
        where: { projectId: wp.projectId, statusId: targetStatusId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      })

      return { updatedWp, column }
    })

    return res.status(200).json({
      success: true,
      data: {
        workPackage: {
          id: result.updatedWp.id,
          position: result.updatedWp.position,
          statusId: result.updatedWp.statusId,
        },
        column: {
          statusId: targetStatusId,
          workPackages: result.column,
        },
      },
    })
  },
  {
    methods: ['POST'],
    bodySchema: reorderSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
