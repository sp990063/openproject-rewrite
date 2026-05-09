// pages/api/users/[id]/2fa/setup.ts — Generate TOTP secret + QR code for 2FA setup
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateTOTPSecret, generateTOTPURI, generateQRCodeDataURL } from '@/lib/2fa/totp'
import { generateBackupCodes, createBackupCodeHashes } from '@/lib/2fa/backup-codes'
import { z } from 'zod'

const setupSchema = z.object({
  method: z.enum(['totp', 'webauthn']),
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

  const parsed = setupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
  }

  const { method } = parsed.data

  if (method === 'totp') {
    const secret = generateTOTPSecret()
    const uri = generateTOTPURI(secret, session.user.email || '', 'OpenProject')
    const qrCodeDataUrl = await generateQRCodeDataURL(uri)

    // Store secret temporarily (pending verification)
    await prisma.user.update({
      where: { id: userId },
      data: {
        secondFactorPending: JSON.stringify({ secret, method: 'totp', expiresAt: new Date(Date.now() + 10 * 60 * 1000) }),
      },
    })

    // Generate backup codes
    const codes = generateBackupCodes()
    const hashedCodes = await createBackupCodeHashes(codes)
    const hashedCodesJson = JSON.stringify(
      Array.from(hashedCodes.entries()).map(([hashed, plain]) => ({ hashedCode: hashed, plainCode: plain, used: false }))
    )

    return res.status(200).json({
      secret,
      qrCodeDataUrl,
      backupCodes: codes, // Plain codes shown ONCE to user
      backupCodesHint: hashedCodesJson, // Stored in DB
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
  }

  return res.status(400).json({ error: 'Unsupported 2FA method' })
}
