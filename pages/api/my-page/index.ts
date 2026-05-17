import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'

const DEFAULT_WIDGETS = [
  { id: 'default-assigned', type: 'assigned_work_packages', config: {}, position: { x: 0, y: 0, w: 3, h: 2 }, collapsed: false },
  { id: 'default-watched', type: 'watched_work_packages', config: {}, position: { x: 0, y: 2, w: 3, h: 2 }, collapsed: false },
  { id: 'default-time', type: 'time_entries_this_week', config: {}, position: { x: 3, y: 0, w: 3, h: 2 }, collapsed: false },
  { id: 'default-meetings', type: 'upcoming_meetings', config: {}, position: { x: 3, y: 2, w: 3, h: 2 }, collapsed: false },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) {
    return res.status(401).json(errorResponse('UNAUTHORIZED', 'Not authenticated'))
  }

  if (req.method === 'GET') {
    // Return default widgets (simplified - no DB persistence yet)
    const widgets = DEFAULT_WIDGETS.map(w => ({ ...w, userId: session.user.id }))
    return res.json(successResponse({ widgets }))
  }

  if (req.method === 'PUT') {
    const schema = z.object({
      widgets: z.array(z.object({
        id: z.string(),
        type: z.string(),
        config: z.record(z.string(), z.unknown()).optional(),
        position: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
        collapsed: z.boolean().optional(),
      })),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input'))
    }
    // Simplified: just return success (full impl would persist to DB)
    return res.json(successResponse({ saved: parsed.data.widgets.length }))
  }

  return res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed'))
}