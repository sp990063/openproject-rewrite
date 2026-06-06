// pages/api/projects/[projectId]/members/invite/index.ts
//
// Spec §3.5.1: send a project invitation. Requires `members.manage`
// (or system admin). Generates a secure token, persists an `Invite`
// row, and (best-effort) emails the invitee.
//
// Body:
//   { email: string, roleId: string }
//
// Response:
//   201 { success: true, data: { id, email, roleId, expiresAt, acceptUrl } }
//   401 UNAUTHORIZED
//   403 FORBIDDEN (not members.manage)
//   404 NOT_A_MEMBER
//   409 INVITE_EXISTS (an unexpired invite to the same email+project exists)
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'
import { checkProjectPermission } from '@/lib/permissions/check'
import { generateSecureToken } from '@/lib/crypto'
import { sendInviteEmail } from '@/lib/notifications/email'

const INVITE_TTL_DAYS = 7

const inviteSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
})

export default withRoute<z.infer<typeof inviteSchema>, unknown, { projectId: string }>(
  async ({ res, session, body, params }) => {
    const { projectId } = params
    if (!projectId) {
      throw new ApiError(400, 'BAD_REQUEST', 'Project ID is required')
    }

    // RBAC: members.manage on this project
    const ok = await checkProjectPermission(projectId, 'members.manage', session)
    if (!ok) {
      if (!session?.user?.id) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required')
      const member = await prisma.member.findUnique({
        where: { userId_projectId: { userId: session.user.id, projectId } },
        select: { id: true },
      })
      throw new ApiError(member ? 403 : 404, member ? 'FORBIDDEN' : 'NOT_A_MEMBER', 'Insufficient permission')
    }

    // Validate roleId exists
    const role = await prisma.role.findUnique({ where: { id: body.roleId } })
    if (!role) {
      throw new ApiError(400, 'INVALID_ROLE', 'Role not found')
    }

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, identifier: true },
    })
    if (!project) {
      throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found')
    }

    // Reject if a non-expired, non-accepted invite already exists for this email
    const existing = await prisma.invite.findFirst({
      where: {
        projectId,
        email: body.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (existing) {
      throw new ApiError(409, 'INVITE_EXISTS', 'An active invite already exists for this email')
    }

    const token = generateSecureToken(32)
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

    const invite = await prisma.invite.create({
      data: {
        email: body.email,
        projectId,
        roleId: body.roleId,
        token,
        expiresAt,
        invitedBy: session.user.id,
      },
    })

    // Build accept URL (works for both new + existing users)
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'
    const acceptUrl = `${baseUrl}/invites/accept?token=${encodeURIComponent(token)}`

    // Best-effort email send — log but don't fail the request
    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    })
    await sendInviteEmail({
      to: body.email,
      invitedByName: inviter?.name ?? 'A project admin',
      projectName: project.name,
      roleName: role.name,
      acceptUrl,
      expiresAt: expiresAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    })

    return res.status(201).json({
      success: true,
      data: {
        id: invite.id,
        email: invite.email,
        roleId: invite.roleId,
        expiresAt: invite.expiresAt,
        acceptUrl,
      },
    })
  },
  {
    methods: ['POST'],
    bodySchema: inviteSchema,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
