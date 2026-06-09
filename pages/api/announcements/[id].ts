import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isSystemAdmin } from '@/lib/auth'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const paramsSchema = z.object({
  id: z.string(),
})

const updateAnnouncementSchema = z.object({
  content: z.string().min(1).optional(),
  type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  dismissible: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

/**
 * PUT    /api/announcements/[id]  — Update an announcement (admin only).
 * DELETE /api/announcements/[id]  — Delete an announcement (admin only).
 */
export default withRoute<z.infer<typeof updateAnnouncementSchema>, unknown, z.input<typeof paramsSchema>>(
  async ({ req, res, body, params, session }) => {
    const { id } = params

    // Admin check (B-3.3: kept in the handler body for the same reason
    // as the index route — isSystemAdmin() is async and the HOF rbac
    // callback is sync).
    const isAdmin = await isSystemAdmin(session.user.id)
    if (!isAdmin) {
      throw new ApiError(403, 'FORBIDDEN', 'Admin only')
    }

    if (req.method === 'PUT') {
      try {
        const announcement = await prisma.announcement.update({
          where: { id },
          data: {
            ...(body.content !== undefined && { content: body.content }),
            ...(body.type !== undefined && { type: body.type }),
            ...(body.dismissible !== undefined && { dismissible: body.dismissible }),
            ...(body.startsAt !== undefined && { startsAt: body.startsAt ? new Date(body.startsAt) : null }),
            ...(body.endsAt !== undefined && { endsAt: body.endsAt ? new Date(body.endsAt) : null }),
          },
        })
        return res.status(200).json({ success: true, data: announcement })
      } catch (error) {
        if (error instanceof Error && error.message.includes('Record to update not found')) {
          throw new ApiError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found')
        }
        throw error
      }
    }

    if (req.method === 'DELETE') {
      try {
        await prisma.announcement.delete({ where: { id } })
        return res.status(204).end()
      } catch (error) {
        if (error instanceof Error && error.message.includes('Record to delete')) {
          throw new ApiError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found')
        }
        throw error
      }
    }

    return undefined
  },
  {
    methods: ['PUT', 'DELETE'],
    bodySchema: updateAnnouncementSchema,
    paramsSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
