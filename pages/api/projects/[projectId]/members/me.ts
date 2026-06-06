// pages/api/projects/[projectId]/members/me.ts
//
// Spec §4.4: returns the current user's membership (role + permissions)
// for the given project. Powers the `usePermission` client hook.
//
// Response shape (200):
//   { success: true, data: { id, userId, projectId, role: { id, name, permissions } } | null }
//
// Returns `data: null` when the user is not a member of the project
// (200, not 404 — the hook treats "not a member" as a permission
// denial, not an error). 401 when no session.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

export default withRoute<unknown, unknown, { projectId: string }>(
  async ({ res, session, params }) => {
    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    const membership = await prisma.member.findUnique({
      where: {
        userId_projectId: { userId: session.user.id, projectId },
      },
      include: {
        role: { select: { id: true, name: true, permissions: true } },
      },
    })

    // 200 with `data: null` is the spec-prescribed "not a member" shape.
    return res.status(200).json({ success: true, data: membership ?? null })
  },
  {
    methods: ['GET'],
    // No body, no query schema needed.
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
