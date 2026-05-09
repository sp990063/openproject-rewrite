import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { requireWorkPackagePermission } from '@/lib/permissions/work-packages'

const reorderSchema = z.object({
  workPackageId: z.string().cuid(),
  targetStatusId: z.string().cuid(),
  position: z.number().int().min(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  if (process.env.NODE_ENV !== 'test') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  try {
    const { workPackageId, targetStatusId, position: rawPosition } = reorderSchema.parse(req.body)

    // Fetch current work package
    const wp = await prisma.workPackage.findUnique({
      where: { id: workPackageId },
      select: { id: true, projectId: true, statusId: true, position: true },
    })

    if (!wp) {
      return res.status(404).json({ error: 'Work package not found', code: 'WORK_PACKAGE_NOT_FOUND' })
    }

    // Permission check
    const permError = await requireWorkPackagePermission(workPackageId, 'WORK_PACKAGE_EDIT')
    if (permError) {
      return res.status(permError.status).json({ error: permError.code === 'FORBIDDEN' ? 'Forbidden' : 'Work package not found', code: permError.code })
    }

    // Verify target status exists in the project
    const targetStatus = await prisma.status.findUnique({
      where: { id: targetStatusId },
      select: { id: true },
    })
    if (!targetStatus) {
      return res.status(404).json({ error: 'Status not found', code: 'STATUS_NOT_FOUND' })
    }

    // Count work packages in target status column
    const columnCount = await prisma.workPackage.count({
      where: { projectId: wp.projectId, statusId: targetStatusId },
    })

    // Clamp position to valid range
    const targetPosition = Math.max(0, Math.min(rawPosition, columnCount))

    // No-op: same status + same position
    if (wp.statusId === targetStatusId && wp.position === targetPosition) {
      const currentColumn = await prisma.workPackage.findMany({
        where: { projectId: wp.projectId, statusId: targetStatusId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      })
      return res.status(200).json({
        workPackage: { id: wp.id, position: wp.position, statusId: wp.statusId },
        column: { statusId: targetStatusId, workPackages: currentColumn },
      })
    }

    const oldStatusId = wp.statusId
    const oldPosition = wp.position
    const isMovingToNewColumn = oldStatusId !== targetStatusId

    // Perform reorder in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      if (isMovingToNewColumn) {
        // ── Moving to a different column ──────────────────────────────────
        // Step 1: Shift DOWN the old column (items after old position shift -1)
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: oldStatusId,
            position: { gt: oldPosition },
          },
          data: { position: { decrement: 1 } },
        })

        // Step 2: Shift UP the target column (items at or after target position shift +1)
        await tx.workPackage.updateMany({
          where: {
            projectId: wp.projectId,
            statusId: targetStatusId,
            position: { gte: targetPosition },
          },
          data: { position: { increment: 1 } },
        })
      } else {
        // ── Moving within the same column ────────────────────────────────
        if (oldPosition > targetPosition) {
          // Moving UP: shift intermediate items DOWN (+1) to make room
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
          // Moving DOWN: shift intermediate items UP (-1) to make room
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

      // Step 3: Update the work package to its new status and position
      const updatedWp = await tx.workPackage.update({
        where: { id: workPackageId },
        data: { statusId: targetStatusId, position: targetPosition },
        select: { id: true, position: true, statusId: true },
      })

      // Step 4: Fetch the full updated target column
      const column = await tx.workPackage.findMany({
        where: { projectId: wp.projectId, statusId: targetStatusId },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      })

      return { updatedWp, column }
    })

    return res.status(200).json({
      workPackage: {
        id: result.updatedWp.id,
        position: result.updatedWp.position,
        statusId: result.updatedWp.statusId,
      },
      column: {
        statusId: targetStatusId,
        workPackages: result.column,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', code: 'INVALID_POSITION', details: error.issues })
    }
    console.error('Error reordering work package:', error)
    return res.status(500).json({ error: 'Failed to reorder work package' })
  }
}
