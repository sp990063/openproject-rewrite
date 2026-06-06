// pages/api/work-packages/[id].ts
// Phase 0 security fix: GET remains public-readable (project visibility is
// enforced elsewhere), but PATCH/DELETE are now auth-gated. We use the
// lightweight `getServerSession(req, res, authOptions)` 3-arg form inside
// the mutation handlers — same pattern already used in 32 other API routes.
// TODO Phase 1: migrate the whole file to withRoute HOF + rbac callback.
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'
import { emitActivity, makeSubjectId } from '@/lib/activity'
import { authOptions } from '@/lib/auth'

const updateWorkPackageSchema = z.object({
  subject: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  statusId: z.string().cuid().optional(),
  typeId: z.string().cuid().optional(),
  priorityId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  parentId: z.string().cuid().nullable().optional(),
  position: z.number().int().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.startDate) <= new Date(data.dueDate)
    }
    return true
  },
  { message: 'dueDate must be >= startDate', path: ['dueDate'] }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req
  const id = query.id as string

  if (!id) {
    return res.status(400).json({ error: 'Work package ID is required' })
  }

  // Rate limiting for write methods (skip in test environment)
  if (process.env.NODE_ENV !== 'test' && req.method !== 'GET') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const success = await checkRateLimit(ip as string)
    if (!success) {
      return res.status(429).json({ error: 'Too many requests' })
    }
  }

  switch (req.method) {
    case 'GET':
      return getWorkPackage(req, res, id)
    case 'PATCH':
      return updateWorkPackage(req, res, id)
    case 'DELETE':
      return deleteWorkPackage(req, res, id)
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

async function getWorkPackage(req: NextApiRequest, res: NextApiResponse, id: string) {
  try {
    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      include: {
        project: true,
        status: true,
        type: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parent: true,
        children: true,
      },
    })

    if (!workPackage) {
      return res.status(404).json({ error: 'Work package not found' })
    }

    return res.status(200).json(workPackage)
  } catch (error) {
    console.error('Error fetching work package:', error)
    return res.status(500).json({ error: 'Failed to fetch work package' })
  }
}

async function updateWorkPackage(req: NextApiRequest, res: NextApiResponse, id: string) {
  // Phase 0: auth + RBAC. Reject anonymous edits outright.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  // RBAC: caller must be a project member (or system admin) of the WP's project.
  const wp0 = await prisma.workPackage.findUnique({
    where: { id },
    select: { projectId: true },
  })
  if (!wp0) {
    return res.status(404).json({ error: 'Work package not found' })
  }
  if (!session.user.isSystemAdmin) {
    const member = await prisma.member.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId: wp0.projectId } },
      include: { role: { select: { permissions: true } } },
    })
    if (!member || !member.role.permissions.includes('WORK_PACKAGE_EDIT')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  try {
    const data = updateWorkPackageSchema.parse(req.body)

    // Get old values for activity log
    const old = await prisma.workPackage.findUnique({ where: { id } })

    const workPackage = await prisma.workPackage.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
      },
      include: {
        project: true,
        status: true,
        type: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })

    // Create activity for all field changes (including date fields)
    const dateFields = ['startDate', 'dueDate']
    const changes: Record<string, { old: unknown; new: unknown }> = {}

    for (const key of Object.keys(data)) {
      const oldVal = (old as Record<string, unknown>)?.[key]
      const newVal = (workPackage as Record<string, unknown>)?.[key]

      // For date fields, compare as ISO strings; for others, direct comparison
      if (dateFields.includes(key)) {
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : (oldVal as string)
        const newStr = newVal instanceof Date ? newVal.toISOString() : (newVal as string)
        if (oldStr !== newStr) {
          changes[key] = { old: oldStr, new: newStr }
        }
      } else if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal }
      }
    }

    if (Object.keys(changes).length > 0) {
      await prisma.activity.create({
        data: {
          workPackageId: id,
          userId: workPackage.authorId,
          action: 'updated',
          details: JSON.parse(JSON.stringify(changes)),
        },
      })

      // Emit unified activity
      await emitActivity({
        projectId: workPackage.projectId,
        userId: workPackage.authorId,
        subjectType: 'work_package',
        subjectId: workPackage.id,
        action: 'updated',
        details: changes,
        reference: {
          type: 'work_package',
          id: workPackage.id,
          subject: workPackage.subject,
          projectName: workPackage.project.name,
        },
      })
    }

    return res.status(200).json(workPackage)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues })
    }
    console.error('Error updating work package:', error)
    return res.status(500).json({ error: 'Failed to update work package' })
  }
}

async function deleteWorkPackage(req: NextApiRequest, res: NextApiResponse, id: string) {
  // Phase 0: auth + RBAC. Reject anonymous deletes outright.
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    // Get work package for activity reference + RBAC check
    const workPackage = await prisma.workPackage.findUnique({
      where: { id },
      select: { projectId: true, subject: true, authorId: true, project: { select: { name: true } } },
    })

    if (!workPackage) {
      return res.status(404).json({ error: 'Work package not found' })
    }

    if (!session.user.isSystemAdmin) {
      const member = await prisma.member.findUnique({
        where: { userId_projectId: { userId: session.user.id, projectId: workPackage.projectId } },
        include: { role: { select: { permissions: true } } },
      })
      if (!member || !member.role.permissions.includes('WORK_PACKAGE_DELETE')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    await prisma.workPackage.delete({
      where: { id },
    })

    // Emit unified activity
    await emitActivity({
      projectId: workPackage.projectId,
      userId: workPackage.authorId,
      subjectType: 'work_package',
      subjectId: id,
      action: 'deleted',
      reference: {
        type: 'work_package',
        id,
        subject: workPackage.subject,
        projectName: workPackage.project.name,
      },
    })

    return res.status(204).end()
  } catch (error) {
    console.error('Error deleting work package:', error)
    return res.status(500).json({ error: 'Failed to delete work package' })
  }
}
