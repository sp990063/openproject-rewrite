// pages/api/meetings/[id]/agenda/index.ts
// Phase 7 Sprint B-2: migrated from direct handler to withRoute HOF
// (was: 92-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertMeetingProjectMembership
//     for GET/POST (was: 200/201 with data — non-members could read
//     agenda + add agenda items to meetings in projects they weren't in)
//   - 404 from assertMeetingProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertMeetingProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const createAgendaItemSchema = z.object({
  title: z.string().min(1).max(255),
  notes: z.string().optional().default(''),
  duration: z.number().int().positive().optional(),
  position: z.number().int().min(0).optional().default(0),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const id = query.id as string
    if (!id) {
      throw new ApiError(400, 'BAD_REQUEST', 'Meeting ID is required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const items = await prisma.meetingAgendaItem.findMany({
          where: { meetingId: id },
          orderBy: { position: 'asc' },
        })
        return res.status(200).json(items)
      }

      case 'POST': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const item = await prisma.meetingAgendaItem.create({
          data: {
            meetingId: id,
            title: body.title,
            notes: body.notes || null,
            duration: body.duration ?? null,
            position: body.position,
          },
        })
        return res.status(201).json(item)
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createAgendaItemSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
