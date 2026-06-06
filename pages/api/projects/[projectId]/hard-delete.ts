// pages/api/projects/[projectId]/hard-delete.ts
//
// Spec §3.3b — GDPR right-to-erasure endpoint.
//
// Hard delete is the **last resort** — projects should be archived
// (status='archived') for normal offboarding. This endpoint exists
// **only** for GDPR "right to be forgotten" requests, where audit-
// trail retention is overridden by data subject rights.
//
// Authorization: system admins only (not just `project.delete`).
// Deletion reason is **required** for the audit log.
//
// Behavior (per spec §3.3b L3 FIX):
//   - Log + delete in the same Prisma transaction
//   - ProjectDeletionLog row is written FIRST, then project.delete()
//   - Prisma's `onDelete: Cascade` relations remove children (members,
//     workPackages, etc.) automatically
//   - The log row is preserved via the `SetNull` cascade (projectId
//     becomes null after the project is gone, but the row stays for
//     compliance audits)
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const hardDeleteSchema = z.object({
  reason: z
    .string()
    .min(3, 'Deletion reason must be at least 3 characters')
    .max(500, 'Deletion reason must be at most 500 characters'),
})

export default withRoute<
  z.infer<typeof hardDeleteSchema>,
  unknown,
  { projectId: string }
>(
  async ({ req, res, session, body, params }) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      // The spec wrote this as a DELETE handler in §3.3b but the body
      // (reason) is more natural in POST. Accept both for flexibility.
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'POST or DELETE only')
    }

    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    // System admins only — NOT just `project.delete`. Hard delete is
    // destructive enough that even a project Admin role is insufficient.
    if (session.user.isSystemAdmin !== true) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'System administrator privileges required for hard delete',
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    })
    if (!project) {
      throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
    }

    // L3 FIX: log + delete in a single transaction so a partial
    // failure can never leave a log row referring to a live project
    // (or vice-versa) — keeps the audit trail consistent.
    await prisma.$transaction(async (tx) => {
      await tx.projectDeletionLog.create({
        data: {
          projectId,
          projectName: project.name, // snapshot — survives hard delete
          action: 'HARD_DELETE',
          performedBy: session.user.id,
          reason: body.reason,
        },
      })
      await tx.project.delete({ where: { id: projectId } })
    })

    return res.status(200).json({
      success: true,
      data: {
        deleted: true,
        projectId,
        projectName: project.name,
      },
    })
  },
  {
    methods: ['POST', 'DELETE'],
    bodySchema: hardDeleteSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
