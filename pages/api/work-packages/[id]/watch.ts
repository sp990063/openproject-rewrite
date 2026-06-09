import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertWorkPackageProjectMembership } from '@/lib/auth/project'
// Phase 6 Sprint 1: SSE push on the 'watched' notification
import { broadcastNotification } from '@/lib/notifications/realtime'

const paramsSchema = z.object({
  id: z.string(),
})

/**
 * GET    /api/work-packages/[id]/watch  — Returns { isWatching, count }.
 * POST   /api/work-packages/[id]/watch  — Adds current user as watcher.
 * DELETE /api/work-packages/[id]/watch  — Removes current user from watchers.
 *
 * B-3.4: Project membership gate added. Previously any logged-in user
 * could read/watch/unwatch any work package by ID, which leaked WP
 * existence and let non-members subscribe to private project updates.
 */
export default withRoute<unknown, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, params, session }) => {
    const { id } = params

    // Project membership gate (B-3.4).
    await assertWorkPackageProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    const userId = session.user.id

    if (req.method === 'GET') {
      const workPackage = await prisma.workPackage.findUnique({
        where: { id },
        select: {
          id: true,
          watchers: { select: { id: true } },
        },
      })
      if (!workPackage) {
        throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
      }

      const isWatching = workPackage.watchers.some((w) => w.id === userId)
      const count = workPackage.watchers.length
      return res.status(200).json({ success: true, data: { isWatching, count } })
    }

    if (req.method === 'POST') {
      const workPackage = await prisma.workPackage.findUnique({
        where: { id },
        select: {
          id: true,
          subject: true,
          projectId: true,
          project: { select: { name: true } },
          assigneeId: true,
        },
      })
      if (!workPackage) {
        throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
      }

      // Add user to watchers if not already watching
      await prisma.workPackage.update({
        where: { id },
        data: { watchers: { connect: { id: userId } } },
      })

      const updated = await prisma.workPackage.findUnique({
        where: { id },
        select: { id: true, watchers: { select: { id: true } } },
      })

      // Phase 5 Sprint 3: notify the assignee (if not the actor) of the
      // new watcher. Phase 6 Sprint 1: SSE push so the assignee's open
      // tabs update without waiting for the 30s polling cycle.
      if (workPackage.assigneeId && workPackage.assigneeId !== userId) {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
        const notification = await prisma.notification.create({
          data: {
            userId: workPackage.assigneeId,
            reason: 'watched',
            projectId: workPackage.projectId,
            projectName: workPackage.project.name,
            resourceType: 'work_package',
            resourceId: workPackage.id,
            resourceSubject: workPackage.subject,
            actorId: userId,
            actorName: actor?.name ?? actor?.email ?? 'Someone',
          },
        })
        try {
          await broadcastNotification(notification.userId, notification.id)
        } catch (sseErr) {
          console.error('[SSE] broadcastNotification failed:', sseErr)
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          isWatching: true,
          count: updated?.watchers.length ?? 0,
        },
      })
    }

    if (req.method === 'DELETE') {
      const workPackage = await prisma.workPackage.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!workPackage) {
        throw new ApiError(404, 'WORK_PACKAGE_NOT_FOUND', 'Work package not found')
      }

      await prisma.workPackage.update({
        where: { id },
        data: { watchers: { disconnect: { id: userId } } },
      })

      const updated = await prisma.workPackage.findUnique({
        where: { id },
        select: { id: true, watchers: { select: { id: true } } },
      })

      return res.status(200).json({
        success: true,
        data: {
          isWatching: false,
          count: updated?.watchers.length ?? 0,
        },
      })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST', 'DELETE'],
    paramsSchema,
  }
)
