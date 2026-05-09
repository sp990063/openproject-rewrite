// pages/api/users/[id]/2fa/disable.ts — Disable 2FA (requires password + TOTP or backup code)
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { verifyTOTP } from '@/lib/2fa/totp'
import { verifyBackupCode } from '@/lib/2fa/backup-codes'
import { z } from 'zod'

const disableSchema = z.object({
  password: z.string().min(1),
  token: z.string().min(1).optional(),
  backupCode: z.string().min(1).optional(),
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

  const parsed = disableSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const { password, token, backupCode } = parsed.data

  // Verify password first
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, totpSecret: true, backupCodes: true },
  })

  if (!user?.passwordHash) {
    return res.status(400).json({ error: 'Cannot disable 2FA: no password set' })
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)
  if (!passwordValid) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  // Verify 2FA: either TOTP or backup code
  if (token && user.totpSecret) {
    const isValid = verifyTOTP(token, user.totpSecret)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid TOTP code' })
    }
  } else if (backupCode && user.backupCodes) {
    const codes: Array<{ hashedCode: string; plainCode: string; used: boolean }> = JSON.parse(user.backupCodes)
    const codeEntry = codes.find(c => !c.used && c.plainCode?.toLowerCase() === backupCode.toLowerCase())
    if (!codeEntry) {
      return res.status(401).json({ error: 'Invalid backup code' })
    }
    // Mark backup code as used
    codeEntry.used = true
    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: JSON.stringify(codes) },
    })
  } else {
    return res.status(400).json({ error: 'TOTP token or backup code required' })
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabled: false,
      backupCodes: null,
    },
  })

  // Also delete WebAuthn credentials
  await prisma.webAuthnCredential.deleteMany({ where: { userId } })

  return res.status(200).json({ success: true, disabled: true })
}
