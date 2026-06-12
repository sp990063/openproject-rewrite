// pages/api/meetings/[id]/agenda/[agendaId]/index.ts
// Phase 7 Sprint B-2: migrated from direct handler to withRoute HOF
// (was: 89-line direct handler with inline getServerSession+401, see
//  Phase 7 Sprint A4 3b26d89 for the auth-only fix). Behavior changes:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check via
//     assertMeetingAgendaProjectMembership for PATCH/DELETE (was: no
//     RBAC — any logged-in user could modify agenda items in any project)
//   - 404 from assertMeetingAgendaProjectMembership (was: 500 with
//     console.error; 400 string-mismatch check was a workaround for the
//     missing membership check — now unnecessary)
//   - Uniform error envelope via ApiError for all errors
//   - Body validation: withRoute bodySchema (was: inline safeParse)
//   - Method allow-list: enforced by withRoute's methods config
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertMeetingAgendaProjectMembership } from '@/lib/auth/project'
import { z } from 'zod'

const updateAgendaItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  notes: z.string().nullable().optional(),
  duration: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

export default withRoute(
  async ({ req, res, session, body, query }) => {
    const id = query.id as string
    const agendaId = query.agendaId as string
    if (!id || !agendaId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Meeting ID and Agenda Item ID are required')
    }
    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'PATCH': {
        await assertMeetingAgendaProjectMembership(agendaId, session.user.id, isAdmin)
        const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: agendaId } })
        if (!existing) {
          throw new ApiError(404, 'AGENDA_ITEM_NOT_FOUND', 'Agenda item not found')
        }
        if (existing.meetingId !== id) {
          throw new ApiError(400, 'MISMATCH', 'Agenda item does not belong to this meeting')
        }
        // Phase 3 Sprint 7 FM-7 fix: when position changes, shift siblings
        // to avoid position collisions. The single-item PATCH below
        // creates gaps and duplicates when two items end up at the same
        // position. We do this in a single transaction so a partial
        // reorder can't be observed.
        const item = await prisma.$transaction(async (tx) => {
          if (body.position !== undefined && body.position !== existing.position) {
            const newPos = body.position
            const oldPos = existing.position
            // Clamp newPos into [0, totalItems-1] so the client can't
            // request a position larger than the array.
            const total = await tx.meetingAgendaItem.count({ where: { meetingId: id } })
            const clamped = Math.max(0, Math.min(newPos, total - 1))
            // Shift everything between the old and new positions by 1.
            if (clamped < oldPos) {
              // Moving up: shift items in [clamped, oldPos) up by 1.
              await tx.meetingAgendaItem.updateMany({
                where: {
                  meetingId: id,
                  position: { gte: clamped, lt: oldPos },
                  id: { not: agendaId },
                },
                data: { position: { increment: 1 } },
              })
            } else if (clamped > oldPos) {
              // Moving down: shift items in (oldPos, clamped] down by 1.
              await tx.meetingAgendaItem.updateMany({
                where: {
                  meetingId: id,
                  position: { gt: oldPos, lte: clamped },
                  id: { not: agendaId },
                },
                data: { position: { decrement: 1 } },
              })
            }
            return tx.meetingAgendaItem.update({
              where: { id: agendaId },
              data: {
                ...(body.title !== undefined && { title: body.title }),
                ...(body.notes !== undefined && { notes: body.notes }),
                ...(body.duration !== undefined && { duration: body.duration }),
                position: clamped,
              },
            })
          }
          // No position change — straight update.
          return tx.meetingAgendaItem.update({
            where: { id: agendaId },
            data: {
              ...(body.title !== undefined && { title: body.title }),
              ...(body.notes !== undefined && { notes: body.notes }),
              ...(body.duration !== undefined && { duration: body.duration }),
              ...(body.position !== undefined && { position: body.position }),
            },
          })
        })
        return res.status(200).json(item)
      }

      case 'DELETE': {
        await assertMeetingAgendaProjectMembership(agendaId, session.user.id, isAdmin)
        const existing = await prisma.meetingAgendaItem.findUnique({ where: { id: agendaId } })
        if (!existing) {
          throw new ApiError(404, 'AGENDA_ITEM_NOT_FOUND', 'Agenda item not found')
        }
        if (existing.meetingId !== id) {
          throw new ApiError(400, 'MISMATCH', 'Agenda item does not belong to this meeting')
        }
        await prisma.meetingAgendaItem.delete({ where: { id: agendaId } })
        return res.status(204).end()
      }

      default:
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`)
    }
  },
  {
    methods: ['PATCH', 'DELETE'],
    bodySchema: updateAgendaItemSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
