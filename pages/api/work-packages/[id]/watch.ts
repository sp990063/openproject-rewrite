import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/work-packages/[id]/watch
 * Returns { isWatching: boolean, count: number }
 *
 * POST /api/work-packages/[id]/watch
 * Adds current user as watcher
 *
 * DELETE /api/work-packages/[id]/watch
 * Removes current user from watchers
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Work package ID is required' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const userId = session.user.id

  switch (req.method) {
    case 'GET':
      return getWatchStatus(req, res, id, userId)
    case 'POST':
      return watchWorkPackage(req, res, id, userId)
    case 'DELETE':
      return unwatchWorkPackage(req, res, id, userId)
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWatchStatus(req: NextApiRequest, res: NextApiResponse, id: string, userId: string) {
  try {
    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      select: {
        id: true,
        watchers: {
          select: { id: true },
        },
      },
    })

    if (!workPackage) {
      return res.status(404).json({ error: 'Work package not found' })
    }

    const isWatching = workPackage.watchers.some((w) => w.id === userId)
    const count = workPackage.watchers.length

    return res.status(200).json({ isWatching, count })
  } catch (error) {
    console.error('Error fetching watch status:', error)
    return res.status(500).json({ error: 'Failed to fetch watch status' })
  }
}

async function watchWorkPackage(req: NextApiRequest, res: NextApiResponse, id: string, userId: string) {
  try {
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
      return res.status(404).json({ error: 'Work package not found' })
    }

    // Add user to watchers if not already watching
    await prisma.workPackage.update({
      where: { id },
      data: {
        watchers: {
          connect: { id: userId },
        },
      },
    })

    // Get updated count
    const updated = await prisma.workPackage.findUnique({
      where: { id },
      select: {
        id: true,
        watchers: {
          select: { id: true },
        },
      },
    })

    // Phase 5 Sprint 3: if the current user is the assignee, the act of
    // self-watching doesn't need a notification. Otherwise, notify the
    // assignee that someone (other than them) is now watching. Spec
    // §2.2 NotificationReason includes 'watched' for this case.
    if (workPackage.assigneeId && workPackage.assigneeId !== userId) {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      })
      await prisma.notification.create({
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
    }

    return res.status(200).json({
      isWatching: true,
      count: updated?.watchers.length ?? 0,
    })
  } catch (error) {
    console.error('Error watching work package:', error)
    return res.status(500).json({ error: 'Failed to watch work package' })
  }
}

async function unwatchWorkPackage(req: NextApiRequest, res: NextApiResponse, id: string, userId: string) {
  try {
    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!workPackage) {
      return res.status(404).json({ error: 'Work package not found' })
    }

    // Remove user from watchers
    await prisma.workPackage.update({
      where: { id },
      data: {
        watchers: {
          disconnect: { id: userId },
        },
      },
    })

    // Get updated count
    const updated = await prisma.workPackage.findUnique({
      where: { id },
      select: {
        id: true,
        watchers: {
          select: { id: true },
        },
      },
    })

    return res.status(200).json({
      isWatching: false,
      count: updated?.watchers.length ?? 0,
    })
  } catch (error) {
    console.error('Error unwatching work package:', error)
    return res.status(500).json({ error: 'Failed to unwatch work package' })
  }
}
