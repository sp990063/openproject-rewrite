// pages/api/projects/bulk-archive.ts
//
// Spec §3.3c — D9 FIX: batch archive multiple projects in one request.
//
// Why a dedicated endpoint (vs calling the per-project PATCH N times):
//   - Reduces N round-trips to 1 for admin batch operations
//   - Allows partial success (one project not-found doesn't roll back
//     the whole batch)
//   - Lets the client show per-project results in a single UI screen
//
// Authorization: system admins only. Archive is destructive enough
// (removes memberships, marks project archived) that a per-project
// `project.delete` permission is insufficient for a batch.
//
// Per-project behavior (per spec):
//   1. Verify project exists and is not already archived
//   2. Insert ProjectDeletionLog with action='ARCHIVE' (audit trail)
//   3. Set project status='archived'
//   4. Delete all Member rows for the project (archived projects
//      should not appear in member dashboards, per L2-F FIX)
//
// Each project is processed in its own transaction so a single
// failure cannot roll back the rest of the batch.
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const bulkArchiveSchema = z.object({
  projectIds: z
    .array(z.string().cuid('Each projectId must be a valid cuid'))
    .min(1, 'At least one projectId is required')
    .max(50, 'Maximum 50 projects per batch'),
})

type PerProjectResult =
  | { id: string; status: 'archived' }
  | { id: string; status: 'failed'; error: string }

export default withRoute<z.infer<typeof bulkArchiveSchema>, unknown, unknown>(
  async ({ res, session, body }) => {
    // System admin only — matches the single-project hard-delete
    // authorization model (batch operations need higher privilege).
    if (session.user.isSystemAdmin !== true) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'System administrator privileges required for bulk archive',
      )
    }

    const { projectIds } = body
    const results: PerProjectResult[] = []

    // Process serially — each project is its own transaction so
    // failures are isolated. We could parallelize, but the per-tx
    // Prisma round-trip cost is low enough that serial is fine for
    // batches up to 50.
    for (const projectId of projectIds) {
      try {
        await prisma.$transaction(async (tx) => {
          const project = await tx.project.findUnique({
            where: { id: projectId },
            select: { id: true, status: true, name: true },
          })
          if (!project) {
            throw new Error('PROJECT_NOT_FOUND')
          }
          if (project.status === 'archived') {
            throw new Error('ALREADY_ARCHIVED')
          }

          // Audit log first — D5 FIX: action='ARCHIVE'
          await tx.projectDeletionLog.create({
            data: {
              projectId,
              projectName: project.name,
              action: 'ARCHIVE',
              performedBy: session.user.id,
              reason: 'Bulk archive',
            },
          })

          // Archive the project
          await tx.project.update({
            where: { id: projectId },
            data: { status: 'archived' },
          })

          // Remove memberships (L2-F FIX: archived projects should
          // not appear in member dashboards)
          await tx.member.deleteMany({ where: { projectId } })
        })
        results.push({ id: projectId, status: 'archived' })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Archive failed'
        results.push({
          id: projectId,
          status: 'failed',
          error:
            message === 'PROJECT_NOT_FOUND'
              ? 'Project not found'
              : message === 'ALREADY_ARCHIVED'
                ? 'Already archived'
                : 'Archive failed',
        })
      }
    }

    const archivedCount = results.filter((r) => r.status === 'archived').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    return res.status(200).json({
      success: true,
      data: {
        archived: archivedCount,
        failed: failedCount,
        results,
      },
    })
  },
  {
    methods: ['POST'],
    bodySchema: bulkArchiveSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
