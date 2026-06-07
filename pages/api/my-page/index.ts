// pages/api/my-page/index.ts
// Phase 5 Sprint 2: Persisted My Page layout. One row per user
// (MyPageLayout table). Pre-existing code returned a static 4-widget
// default and the PUT handler was a no-op — both fixed here.
//
// GET  /api/my-page   — fetch the caller's layout (or defaults if none saved)
// PUT  /api/my-page   — replace the caller's layout with the supplied widgets
//   body: { widgets: Widget[] }
//
// Validation matches the existing useMyPage hook signature exactly so
// no frontend changes are needed beyond the data-persistence behaviour.
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

// Default layout for first-time visitors (was the only thing this endpoint
// returned pre-Sprint 2). Kept as a constant so GET and PUT agree.
const DEFAULT_WIDGETS = [
  { id: 'default-assigned', type: 'assigned_work_packages', config: {}, position: { x: 0, y: 0, w: 3, h: 2 }, collapsed: false },
  { id: 'default-watched', type: 'watched_work_packages', config: {}, position: { x: 0, y: 2, w: 3, h: 2 }, collapsed: false },
  { id: 'default-time', type: 'time_entries_this_week', config: {}, position: { x: 3, y: 0, w: 3, h: 2 }, collapsed: false },
  { id: 'default-meetings', type: 'upcoming_meetings', config: {}, position: { x: 3, y: 2, w: 3, h: 2 }, collapsed: false },
]

// Matches the WidgetType union in types/my-page.ts. Kept as a string enum
// here so unknown future widget types (e.g. 'custom_query') are accepted
// without a code change — the client only renders the ones it knows about.
const widgetSchema = z.object({
  id: z.string(),
  type: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  collapsed: z.boolean().optional(),
})

const putSchema = z.object({
  widgets: z.array(widgetSchema),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'))
  }
  const userId = session.user.id

  if (req.method === 'GET') {
    const row = await prisma.myPageLayout.findUnique({ where: { userId } })
    // First-time visitors get the defaults (same shape as the pre-Sprint-2
    // stub). Returning the saved widgets array directly matches the hook
    // contract: hook does `json.data.widgets as MyPageWidget[]`.
    const widgets = row
      ? (row.widgets as unknown as Array<typeof DEFAULT_WIDGETS[number]>)
      : DEFAULT_WIDGETS
    return res.json(successResponse({ widgets }))
  }

  if (req.method === 'PUT') {
    const parsed = putSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(
        errorResponse('VALIDATION_ERROR', 'Invalid input', parsed.error.flatten())
      )
    }
    // Upsert: first save creates a row, subsequent saves update. The
    // unique constraint on userId enforces 1:1.
    await prisma.myPageLayout.upsert({
      where: { userId },
      create: {
        userId,
        widgets: parsed.data.widgets as unknown as object,
      },
      update: {
        widgets: parsed.data.widgets as unknown as object,
      },
    })
    return res.json(successResponse({ saved: parsed.data.widgets.length }))
  }

  res.setHeader('Allow', ['GET', 'PUT'])
  return res
    .status(405)
    .json(errorResponse('METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`))
}
