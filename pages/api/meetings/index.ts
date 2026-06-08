// pages/api/meetings/index.ts
// Phase 7 Sprint B-2: migrated from direct handler to withRoute HOF
// (was: 130-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertProjectMembership for
//     POST (was: 201 — any logged-in user could create meetings in any
//     project, even projects they weren't members of)
//   - 403 same for GET when ?projectId=X is provided (was: 200 with data —
//     non-members could enumerate meetings + attendees PII in any project)
//   - 404 from assertProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - authorId from session.user.id (was: trusted body.authorId — P0
//     spoof vector)
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
//   - 409 conflict now uses the uniform {success:false,error:{code,message,
//     details}} envelope (was: ad-hoc {error, conflicts} shape)
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertProjectMembership } from '@/lib/auth/project'
import { checkMeetingConflict } from '@/lib/meeting-conflict'
import { z } from 'zod'

const createMeetingSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().optional().default(''),
  attendees: z.array(z.string()).optional().default([]),
})

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  startAfter: z.string().optional(),
  endBefore: z.string().optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        // If projectId is provided, enforce membership; otherwise this is a
        // cross-project list (used by global dashboard widgets) and the
        // session check is the only gate.
        if (query.projectId) {
          await assertProjectMembership(query.projectId, session.user.id, isAdmin)
        }

        const where: {
          projectId?: string
          startTime?: { gte?: Date; lte?: Date }
        } = {}
        if (query.projectId) where.projectId = query.projectId
        if (query.startAfter || query.endBefore) {
          where.startTime = {}
          if (query.startAfter) where.startTime.gte = new Date(query.startAfter)
          if (query.endBefore) where.startTime.lte = new Date(query.endBefore)
        }

        const meetings = await prisma.meeting.findMany({
          where,
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            _count: { select: { agenda: true } },
          },
          orderBy: { startTime: 'asc' },
        })

        return res.status(200).json(meetings)
      }

      case 'POST': {
        await assertProjectMembership(body.projectId, session.user.id, isAdmin)

        const startTime = new Date(body.startTime)
        const endTime = new Date(body.endTime)

        if (endTime <= startTime) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'End time must be after start time')
        }

        // Check for conflicts
        if (body.attendees.length > 0) {
          const conflict = await checkMeetingConflict({
            projectId: body.projectId,
            attendees: body.attendees,
            startTime,
            endTime,
          })
          if (conflict.hasConflict) {
            return res.status(409).json({
              success: false,
              error: {
                code: 'CONFLICT',
                message: 'Scheduling conflict detected',
                details: { conflicts: conflict.conflictingMeetings },
              },
            })
          }
        }

        const meeting = await prisma.meeting.create({
          data: {
            projectId: body.projectId,
            title: body.title,
            startTime,
            endTime,
            location: body.location || null,
            authorId: session.user.id,
            attendees: body.attendees.length > 0 ? {
              create: body.attendees.map((userId) => ({
                userId,
                response: 'none',
              })),
            } : undefined,
          },
          include: {
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            project: { select: { id: true, name: true, identifier: true } },
            attendees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
          },
        })

        return res.status(201).json(meeting)
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createMeetingSchema,
    querySchema: listQuerySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
