// pages/api/users/[id]/2fa/verify.ts — Verify TOTP code and enable 2FA
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTOTP } from '@/lib/2fa/totp'
import { z } from 'zod'

const verifySchema = z.object({
  token: z.string().length(6),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = req.query.id as string
  if (session.user.id !== userId && !session.user.isSystemAdmin) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid token format' })
  }

  const { token } = parsed.data

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { secondFactorPending: true },
  })

  if (!user?.secondFactorPending) {
    return res.status(400).json({ error: 'No pending 2FA setup found' })
  }

  const pending = JSON.parse(user.secondFactorPending)
  if (new Date(pending.expiresAt) < new Date()) {
    return res.status(400).json({ error: '2FA setup expired. Please start again.' })
  }

  if (pending.method !== 'totp') {
    return res.status(400).json({ error: 'Unsupported 2FA method' })
  }

  const isValid = verifyTOTP(token, pending.secret)
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid TOTP code' })
  }

  // Parse backup codes from the stored hint
  let backupCodesJson = null
  if (pending.backupCodesHint) {
    backupCodesJson = pending.backupCodesHint
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: pending.secret,
      totpEnabled: true,
      backupCodes: backupCodesJson,
      secondFactorPending: null,
    },
  })

  return res.status(200).json({ success: true, enabled: true })
}
