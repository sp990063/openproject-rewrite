import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isSystemAdmin } from '@/lib/auth'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const createAnnouncementSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  dismissible: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
})

/**
 * GET  /api/announcements  — List active announcements (auth required,
 *                            see B-3.0 P0 fix; announcements are global
 *                            so no project membership check).
 * POST /api/announcements  — Create a new announcement (admin only).
 */
export default withRoute<z.infer<typeof createAnnouncementSchema>, unknown, unknown>(
  async ({ req, res, body, session }) => {
    if (req.method === 'GET') {
      const now = new Date()
      const announcements = await prisma.announcement.findMany({
        where: {
          OR: [
            { startsAt: null, endsAt: null },
            { startsAt: { lte: now }, endsAt: null },
            { startsAt: null, endsAt: { gte: now } },
            { startsAt: { lte: now }, endsAt: { gte: now } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })
      return res.status(200).json({ success: true, data: announcements })
    }

    if (req.method === 'POST') {
      // Admin check (B-3.3: explicit guard in the handler body; the
      // withRoute rbac callback in config runs first but admin check
      // needs the async isSystemAdmin() lookup which the HOF can't do
      // synchronously — keep this here for parity with B-2 patterns).
      const isAdmin = await isSystemAdmin(session.user.id)
      if (!isAdmin) {
        throw new ApiError(403, 'FORBIDDEN', 'Admin only')
      }

      const announcement = await prisma.announcement.create({
        data: {
          content: body.content,
          type: body.type,
          dismissible: body.dismissible,
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
        },
      })
      return res.status(201).json({ success: true, data: announcement })
    }

    return undefined
  },
  {
    methods: ['GET', 'POST'],
    bodySchema: createAnnouncementSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  }
)
