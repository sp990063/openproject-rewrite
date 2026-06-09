import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { assertRelationProjectMembership } from '@/lib/auth/project'

const paramsSchema = z.object({
  id: z.string(),
})

const updateRelationSchema = z
  .object({
    relationType: z.enum(['blocks', 'blocked_by', 'precedes', 'follows', 'relates']).optional(),
    fromId: z.string().cuid().optional(),
    toId: z.string().cuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

const relationSelect = {
  id: true,
  relationType: true,
  fromId: true,
  toId: true,
  from: { select: { id: true, subject: true, statusId: true, typeId: true } },
  to: { select: { id: true, subject: true, statusId: true, typeId: true } },
}

/**
 * GET    /api/relations/[id]  — Fetch a single work-package relation.
 * PATCH  /api/relations/[id]  — Update relationType / fromId / toId.
 * DELETE /api/relations/[id]  — Remove the relation.
 *
 * B-4: Project membership gate added. Previously any logged-in user
 * could read or modify any relation in the system by guessing or
 * enumerating IDs. The route now uses withRoute HOF +
 * `assertRelationProjectMembership`, which resolves
 * `relationId → relation.from.projectId` and asserts the caller is a
 * member of that project (or a system admin).
 */
export default withRoute<
  z.input<typeof updateRelationSchema>,
  unknown,
  z.input<typeof paramsSchema>
>(
  async ({ req, res, params, body, session }) => {
    const { id } = params

    // Project membership gate (B-4).
    await assertRelationProjectMembership(
      id,
      session.user.id,
      !!session.user.isSystemAdmin
    )

    if (req.method === 'GET') {
      const relation = await prisma.workPackageRelation.findUnique({
        where: { id },
        select: relationSelect,
      })
      if (!relation) {
        throw new ApiError(404, 'RELATION_NOT_FOUND', 'Relation not found')
      }
      return res.status(200).json({ success: true, data: relation })
    }

    if (req.method === 'PATCH') {
      const existing = await prisma.workPackageRelation.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!existing) {
        throw new ApiError(404, 'RELATION_NOT_FOUND', 'Relation not found')
      }

      // Inline body parse (bodySchema is omitted at the config level
      // so DELETE doesn't trigger validation on an undefined body).
      const data = updateRelationSchema.parse(body ?? {})
      const relation = await prisma.workPackageRelation.update({
        where: { id },
        data: {
          ...(data.relationType !== undefined ? { relationType: data.relationType } : {}),
          ...(data.fromId !== undefined ? { fromId: data.fromId } : {}),
          ...(data.toId !== undefined ? { toId: data.toId } : {}),
        },
        select: relationSelect,
      })
      return res.status(200).json({ success: true, data: relation })
    }

    if (req.method === 'DELETE') {
      const existing = await prisma.workPackageRelation.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!existing) {
        throw new ApiError(404, 'RELATION_NOT_FOUND', 'Relation not found')
      }
      await prisma.workPackageRelation.delete({ where: { id } })
      return res.status(204).end()
    }

    return undefined
  },
  {
    methods: ['GET', 'PATCH', 'DELETE'],
    paramsSchema,
    // NOTE: no `bodySchema` here. PATCH validates body inline (after
    // resolving the relation). DELETE carries no body. Adding
    // `bodySchema: updateRelationSchema` would also fire on DELETE
    // and fail validation (empty refine).
  }
)
