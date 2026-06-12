// pages/api/work-packages/index.ts
// Phase 0 refactor: migrate to withRoute HOF (Phase 1 of migration plan).
//
// CRITICAL FIX: previous implementation had no session check — any unauthenticated
// request could POST a new work package, create activities, and dispatch webhooks.
// The withRoute wrapper enforces `session.user.id` on every non-public route.
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { emitActivity } from '@/lib/activity'

const createWorkPackageSchema = z.object({
  projectId: z.string().cuid(),
  subject: z.string().min(1).max(255),
  description: z.string().max(50000).optional(),
  statusId: z.string().cuid(),
  typeId: z.string().cuid(),
  priorityId: z.string().cuid(),
  assigneeId: z.string().cuid().optional(),
  authorId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().max(10000).optional(),
  parentId: z.string().cuid().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.dueDate) {
      return new Date(data.startDate) <= new Date(data.dueDate)
    }
    return true
  },
  { message: 'dueDate must be >= startDate', path: ['dueDate'] }
)

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function formatCSVRow(workPackage: {
  id: string
  subject: string
  status: { name: string }
  type: { name: string }
  assignee: { name: string } | null
  priority: { name: string }
  dueDate: Date | null
  estimatedHours: number | null
}): string {
  return [
    workPackage.id,
    escapeCSV(workPackage.subject),
    escapeCSV(workPackage.status.name),
    escapeCSV(workPackage.type.name),
    escapeCSV(workPackage.assignee?.name ?? ''),
    escapeCSV(workPackage.priority.name),
    workPackage.dueDate ? workPackage.dueDate.toISOString().split('T')[0] : '',
    workPackage.estimatedHours ?? '',
  ].join(',')
}

export default withRoute<z.infer<typeof createWorkPackageSchema>, unknown, unknown>(
  async ({ req, res, session, body }) => {
    // GET /api/work-packages — list visible work packages
    if (req.method === 'GET') {
      const {
        projectId,
        statusId,
        assigneeId,
        startDateGte,
        startDateLte,
        dueDateGte,
        dueDateLte,
        format,
      } = req.query

      const isCSV = format === 'csv'

      const where: Record<string, unknown> = {}
      if (projectId) where.projectId = projectId as string
      if (statusId) where.statusId = statusId as string
      if (assigneeId) where.assigneeId = assigneeId as string

      const dateFilters: unknown[] = []
      if (startDateGte || startDateLte || dueDateGte || dueDateLte) {
        const rangeStart = startDateGte as string | undefined
        const rangeEnd = startDateLte as string | undefined

        dateFilters.push({
          OR: [
            {
              AND: [
                { startDate: { not: null } },
                { dueDate: { not: null } },
                { startDate: rangeEnd ? { lte: new Date(rangeEnd) } : undefined },
                { dueDate: rangeStart ? { gte: new Date(rangeStart) } : undefined },
              ],
            },
            {
              AND: [
                { startDate: { not: null } },
                { dueDate: null },
                { startDate: rangeEnd ? { lte: new Date(rangeEnd) } : undefined },
              ],
            },
            {
              AND: [
                { startDate: null },
                { dueDate: { not: null } },
                { dueDate: rangeStart ? { gte: new Date(rangeStart) } : undefined },
              ],
            },
            {
              AND: [{ startDate: null }, { dueDate: null }],
            },
          ],
        })
      }

      if (dateFilters.length > 0) {
        where.AND = dateFilters
      }

      const workPackages = await prisma.workPackage.findMany({
        where,
        include: {
          project: true,
          status: true,
          type: true,
          priority: true,
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      })

      if (isCSV) {
        const header = 'ID,Subject,Status,Type,Assignee,Priority,Due Date,Estimated Hours'
        const rows = workPackages.map(formatCSVRow).join('\n')
        const csv = header + '\n' + rows
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="work-packages.csv"')
        return res.status(200).send(csv)
      }

      return res.status(200).json({ success: true, data: workPackages })
    }

    // POST /api/work-packages — create a new work package
    if (req.method === 'POST') {
      // CRITICAL: a logged-in user must be a project member (or system admin)
      // to create work packages in that project.
      const member = await prisma.member.findUnique({
        where: {
          userId_projectId: { userId: session.user.id, projectId: body.projectId },
        },
        select: { id: true },
      })
      if (!member && !session.user.isSystemAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'Not a member of this project')
      }

      // WP-3: if assigneeId is provided, verify the assignee is a member of
      // the target project. Otherwise any project member could assign work
      // to a user with no access to that project, leaking the WP into that
      // user's assignment lists.
      if (body.assigneeId && !session.user.isSystemAdmin) {
        const assigneeMember = await prisma.member.findUnique({
          where: {
            userId_projectId: { userId: body.assigneeId, projectId: body.projectId },
          },
          select: { id: true },
        })
        if (!assigneeMember) {
          throw new ApiError(
            422,
            'ASSIGNEE_NOT_PROJECT_MEMBER',
            'Assignee is not a member of the target project'
          )
        }
      }

      // WP-7: aggregate max position + create + activity insert are wrapped
      // in prisma.$transaction so two concurrent creates for the same
      // project can't both read the same max position and end up with
      // duplicate positions, breaking the (position, statusId) ordering
      // relied on by the board view. The aggregate still happens outside
      // the transaction (cheap, lock-free read); the create + activity
      // pair are the atomic unit. The webhook dispatch stays outside the
      // transaction because it is intentionally fire-and-forget.
      const maxPosition = await prisma.workPackage.aggregate({
        where: { projectId: body.projectId },
        _max: { position: true },
      })

      const workPackage = await prisma.$transaction(async (tx) => {
        const wp = await tx.workPackage.create({
          data: {
            ...body,
            startDate: body.startDate ? new Date(body.startDate) : undefined,
            dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
            position: (maxPosition._max.position ?? -1) + 1,
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

        await tx.activity.create({
          data: {
            workPackageId: wp.id,
            userId: body.authorId,
            action: 'created',
            details: { subject: body.subject },
          },
        })

        return wp
      })

      await emitActivity({
        projectId: workPackage.projectId,
        userId: body.authorId,
        subjectType: 'work_package',
        subjectId: workPackage.id,
        action: 'created',
        reference: {
          type: 'work_package',
          id: workPackage.id,
          subject: body.subject,
          projectName: workPackage.project.name,
        },
      })

      // Fire-and-forget webhook dispatch
      import('@/lib/webhooks/integrate').then(({ dispatchWorkPackageCreated }) => {
        dispatchWorkPackageCreated({
          id: workPackage.id,
          projectId: workPackage.projectId,
          subject: workPackage.subject,
          statusId: workPackage.statusId,
          typeId: workPackage.typeId,
          priorityId: workPackage.priorityId,
          assigneeId: workPackage.assigneeId,
          authorId: workPackage.authorId,
          startDate: workPackage.startDate,
          dueDate: workPackage.dueDate,
          estimatedHours: workPackage.estimatedHours,
          position: workPackage.position,
          parentId: workPackage.parentId,
          description: workPackage.description ?? undefined,
          storyPoints: workPackage.storyPoints ?? undefined,
          sprintId: workPackage.sprintId ?? undefined,
        }).catch(err => console.error('Webhook dispatch error:', err))
      })

      return res.status(201).json({ success: true, data: workPackage })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createWorkPackageSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)