// pages/api/meetings/[id]/minutes/index.ts
// Phase 7 Sprint B-2: migrated from direct handler to withRoute HOF
// (was: 117-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via assertMeetingProjectMembership
//     for GET/POST/PATCH (was: 200/201/200 with data — non-members could
//     read minutes PII and create/update minutes in any project)
//   - 404 from assertMeetingProjectMembership (was: 500 with console.error)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - authorId from session.user.id (was: trusted body.authorId — P0
//     spoof vector for createMinutes)
//   - Method allow-list: enforced by withRoute's methods config
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertMeetingProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const createMinutesSchema = z.object({
  content: z.string().min(1),
})

const updateMinutesSchema = z.object({
  content: z.string().min(1),
})

// Either shape validates — PATCH bodies and POST bodies both have `content`.
// Union gives withRoute's bodySchema a typed `body.content` for both.
const minutesBodySchema = z.union([createMinutesSchema, updateMinutesSchema])

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
        const minutes = await prisma.meetingMinutes.findUnique({
          where: { meetingId: id },
          include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        })
        if (!minutes) {
          throw new ApiError(404, 'MINUTES_NOT_FOUND', 'Minutes not found')
        }
        return res.status(200).json(minutes)
      }

      case 'POST': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId: id } })
        if (existing) {
          throw new ApiError(409, 'MINUTES_EXIST', 'Minutes already exist for this meeting. Use PATCH to update.')
        }
        const minutes = await prisma.meetingMinutes.create({
          data: {
            meetingId: id,
            content: body.content,
            authorId: session.user.id,
          },
          include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        })
        return res.status(201).json(minutes)
      }

      case 'PATCH': {
        await assertMeetingProjectMembership(id, session.user.id, isAdmin)
        const existing = await prisma.meetingMinutes.findUnique({ where: { meetingId: id } })
        if (!existing) {
          throw new ApiError(404, 'MINUTES_NOT_FOUND', 'Minutes not found')
        }
        const minutes = await prisma.meetingMinutes.update({
          where: { meetingId: id },
          data: { content: body.content },
          include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        })
        return res.status(200).json(minutes)
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['GET', 'POST', 'PATCH'],
    bodySchema: minutesBodySchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
