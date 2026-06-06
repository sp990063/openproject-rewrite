// pages/api/invites/[token]/accept/index.ts
//
// Spec §3.5.2: accept an invitation. Handles two cases:
//   1. Email matches an existing user → log them in, create Member row
//   2. Email is new → create a User + Member row
//
// Body:
//   { name?: string, password?: string }   (both required if new user)
//
// Response:
//   200 { success: true, data: { userId, projectId, memberId, isNewUser } }
//   400 VALIDATION_ERROR (password too weak / name missing / etc.)
//   404 INVITE_NOT_FOUND or INVITE_EXPIRED
//   409 INVITE_ALREADY_ACCEPTED
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { withRoute, ApiError } from '@/lib/api/withRoute'

const acceptInviteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((p) => /[A-Z]/.test(p), 'Password must contain at least one uppercase letter')
    .refine((p) => /[a-z]/.test(p), 'Password must contain at least one lowercase letter')
    .refine((p) => /[0-9]/.test(p), 'Password must contain at least one number')
    .optional(),
})

export default withRoute<z.infer<typeof acceptInviteSchema>, unknown, { token: string }>(
  async ({ res, body, params }) => {
    const { token } = params
    if (!token) {
      throw new ApiError(400, 'BAD_REQUEST', 'Missing invite token')
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { project: true, role: true },
    })
    if (!invite) {
      throw new ApiError(404, 'INVITE_NOT_FOUND', 'Invite not found')
    }
    if (invite.acceptedAt) {
      throw new ApiError(409, 'INVITE_ALREADY_ACCEPTED', 'This invite has already been used')
    }
    if (invite.expiresAt < new Date()) {
      throw new ApiError(410, 'INVITE_EXPIRED', 'This invite has expired')
    }

    // Check if a user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    })

    let userId: string
    let isNewUser = false

    if (existingUser) {
      // Existing user — they accept directly. No password required.
      userId = existingUser.id
    } else {
      // New user — require name + password
      if (!body.name || !body.password) {
        throw new ApiError(
          400,
          'NEW_USER_REQUIRES_CREDENTIALS',
          'New users must provide name and password to accept this invite',
        )
      }
      const passwordHash = await bcrypt.hash(body.password, 10)
      const newUser = await prisma.user.create({
        data: {
          email: invite.email,
          name: body.name,
          passwordHash,
        },
      })
      userId = newUser.id
      isNewUser = true
    }

    // Create the Member row (idempotent: skip if user is already a member)
    const existingMembership = await prisma.member.findUnique({
      where: { userId_projectId: { userId, projectId: invite.projectId } },
    })
    const member = existingMembership
      ? existingMembership
      : await prisma.member.create({
          data: {
            userId,
            projectId: invite.projectId,
            roleId: invite.roleId,
          },
        })

    // Mark the invite as accepted
    await prisma.invite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        userId,
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        userId,
        projectId: invite.projectId,
        memberId: member.id,
        isNewUser,
      },
    })
  },
  {
    methods: ['POST'],
    bodySchema: acceptInviteSchema,
    // Spec §3.5.2 is a public endpoint (no auth required to accept an
    // invite). The token itself is the bearer credential.
    public: true,
    skipSentryFor: (err) => err instanceof z.ZodError,
  },
)
