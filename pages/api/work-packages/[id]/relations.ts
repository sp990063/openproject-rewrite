// pages/api/work-packages/[id]/relations.ts
// Phase 7 Sprint A2: refactored to withRoute HOF + per-method RBAC
// (was: direct handler with getServerSession+401, see Phase 7 Sprint A1
// 050bdbc for the auth-only fix). Behavior change vs A1:
//   - 401 from withRoute's HOF (was: inline getServerSession)
//   - 403 from project-membership check on GET (NEW: was 200 with data)
//   - 403 from WORK_PACKAGE_EDIT permission on POST/DELETE (NEW: was 200/201/204)
//   - Uniform error envelope via ApiError
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { z } from 'zod'
import { emitActivity } from '@/lib/activity'
import {
  assertWorkPackageViewPermission,
  assertWorkPackageEditPermission,
} from '@/lib/auth/workPackage'

const createRelationSchema = z.object({
  toId: z.string().cuid(),
  relationType: z.enum(['blocks', 'blocked_by', 'precedes', 'follows', 'relates']),
})

export default withRoute(
  async ({ req, res, session, query, body }) => {
    const id = query.id as string
    if (!id) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Work package ID is required' },
      })
    }

    const isAdmin = !!session.user.isSystemAdmin

    switch (req.method) {
      case 'GET': {
        // Read access: any project member
        await assertWorkPackageViewPermission(id, session.user.id, isAdmin)

        const relations = await prisma.workPackageRelation.findMany({
          where: {
            OR: [{ fromId: id }, { toId: id }],
          },
          include: {
            from: { select: { id: true, subject: true, statusId: true, typeId: true } },
            to: { select: { id: true, subject: true, statusId: true, typeId: true } },
          },
          orderBy: { id: 'asc' },
        })

        return res.status(200).json({ success: true, data: relations })
      }

      case 'POST': {
        // Write access: requires WORK_PACKAGE_EDIT
        await assertWorkPackageEditPermission(id, session.user.id, isAdmin)

        const parsed = createRelationSchema.parse(body)
        const relation = await prisma.workPackageRelation.create({
          data: {
            fromId: id,
            toId: parsed.toId,
            relationType: parsed.relationType,
          },
          include: {
            from: { select: { id: true, subject: true, statusId: true, typeId: true } },
            to: { select: { id: true, subject: true, statusId: true, typeId: true } },
          },
        })

        // Emit unified activity for the from work package
        const fromWp = await prisma.workPackage.findUnique({
          where: { id },
          select: { projectId: true, authorId: true },
        })

        if (fromWp) {
          // The activity subjectType is constrained to a known set; for
          // work-package relations we attach via the work_package subject
          // (relation has no direct subjectType slot, see Phase 5
          // schema note: types/activity.ts — fix to add 'relation'
          // tracked separately).
          await emitActivity({
            projectId: fromWp.projectId,
            userId: fromWp.authorId,
            subjectType: 'work_package',
            subjectId: id,
            action: 'created',
            details: { relationType: parsed.relationType, relationId: relation.id, toId: parsed.toId },
            reference: {
              type: 'work_package',
              id,
              subject: relation.from.subject,
            },
          })
        }

        return res.status(201).json({ success: true, data: relation })
      }

      case 'DELETE': {
        // Write access: requires WORK_PACKAGE_EDIT
        await assertWorkPackageEditPermission(id, session.user.id, isAdmin)

        const { relationId } = req.query
        if (!relationId || typeof relationId !== 'string') {
          throw new ApiError(400, 'BAD_REQUEST', 'Relation ID is required')
        }

        const relation = await prisma.workPackageRelation.findUnique({
          where: { id: relationId },
          include: {
            from: { select: { id: true, subject: true, projectId: true, authorId: true } },
            to: { select: { id: true, subject: true } },
          },
        })

        if (!relation) {
          throw new ApiError(404, 'RELATION_NOT_FOUND', 'Relation not found')
        }

        await prisma.workPackageRelation.delete({
          where: { id: relationId },
        })

        // Emit unified activity
        await emitActivity({
          projectId: relation.from.projectId,
          userId: relation.from.authorId,
          subjectType: 'work_package',
          subjectId: id,
          action: 'deleted',
          details: { relationType: relation.relationType, relationId, toId: relation.toId },
          reference: {
            type: 'work_package',
            id,
            subject: relation.from.subject,
          },
        })

        return res.status(204).end()
      }

      default:
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
        })
    }
  },
  {
    methods: ['GET', 'POST', 'DELETE'],
  }
)
