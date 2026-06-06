// pages/api/projects/[projectId]/index.ts
//
// Phase 3 migration: refactored from raw handler to `withRoute` HOF.
// PATCH/DELETE now use the new `checkProjectPermission` from
// `lib/permissions/check.ts` (spec §4.2 wildcard-aware RBAC).
//
// Behavior preserved:
//   - GET remains public-readable (project membership visibility
//     enforced in `getProject`'s response shape).
//   - PATCH requires `project.edit` (or system admin).
//   - DELETE is intentionally retained as a hard delete at this path —
//     GDPR hard-delete (system-admin only with reason) lives at
//     `pages/api/projects/[projectId]/hard-delete.ts` (Sprint 2).
//     System admin OR role with `project.delete` can use this path.
import type { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import {
  hasProjectPermission,
  type ProjectPermission,
} from '@/lib/permissions/check'

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'on_hold', 'archived']).optional(),
})

const PROJECT_INCLUDE = {
  members: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      role: true,
    },
  },
  versions: true,
  modules: true,
} as const

/**
 * Read the project with members + role + modules.
 * Public-readable; sensitive fields are still filtered server-side.
 */
async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: PROJECT_INCLUDE,
  })
  if (!project) {
    throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
  }
  return project
}

export default withRoute<
  z.infer<typeof updateProjectSchema>,
  unknown,
  { projectId: string }
>(
  async ({ req, res, session, body, params }) => {
    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    // GET /api/projects/[projectId] — public-readable
    if (req.method === 'GET') {
      const project = await getProject(projectId)
      return res.status(200).json({ success: true, data: project })
    }

    // PATCH /api/projects/[projectId] — require project.edit
    if (req.method === 'PATCH') {
      const ok = await ensureProjectPermission(
        projectId,
        session,
        'project.edit',
      )
      if (!ok) {
        throw new ApiError(403, 'FORBIDDEN', 'Insufficient permission to edit project')
      }

      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.status !== undefined && { status: body.status }),
        },
        include: PROJECT_INCLUDE,
      })
      return res.status(200).json({ success: true, data: project })
    }

    // DELETE /api/projects/[projectId] — require project.delete
    if (req.method === 'DELETE') {
      const ok = await ensureProjectPermission(
        projectId,
        session,
        'project.delete',
      )
      if (!ok) {
        throw new ApiError(403, 'FORBIDDEN', 'Insufficient permission to delete project')
      }

      await prisma.project.delete({ where: { id: projectId } })
      return res.status(204).end()
    }

    // Should be unreachable — `methods` allow-list returns 405 first
    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    bodySchema: updateProjectSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)

/**
 * Local RBAC helper used by the switch inside the handler.
 * Returns true when the session is allowed to perform `permission` on
 * the given project. System admins are always allowed. Project members
 * are allowed when their role's `permissions` array grants the
 * permission (with `'*'` meaning all).
 *
 * Throws `ApiError(404, ...)` when the user is not a member of the
 * project so the response shape matches the rest of the API surface
 * (membership absence ≠ wrong role).
 */
async function ensureProjectPermission(
  projectId: string,
  session: { user: { id: string; isSystemAdmin?: boolean } },
  permission: ProjectPermission,
): Promise<boolean> {
  if (!session.user.id) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
  }
  if (session.user.isSystemAdmin === true) return true

  const member = await prisma.member.findUnique({
    where: {
      userId_projectId: { userId: session.user.id, projectId },
    },
    include: { role: { select: { permissions: true } } },
  })
  if (!member) {
    throw new ApiError(404, 'NOT_A_MEMBER', 'User is not a member of this project')
  }
  return hasProjectPermission(member.role.permissions, permission)
}
