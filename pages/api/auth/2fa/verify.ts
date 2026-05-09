import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { verifyTotpToken } from '@/lib/2fa/totp'
import { verifyBackupCode } from '@/lib/2fa/backup-codes'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST') {
    const { method, token, backupCode } = req.body

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totpSecret: true, totpEnabled: true, backupCodes: true },
    })

    if (!user) return res.status(404).json({ error: 'User not found' })

    // Verify TOTP
    if (method === 'totp' && token) {
      if (!user.totpEnabled || !user.totpSecret) {
        return res.status(400).json({ error: 'TOTP not enabled' })
      }
      const valid = verifyTotpToken(token, user.totpSecret)
      if (!valid) return res.status(400).json({ error: 'Invalid code' })
      await prisma.user.update({
        where: { id: session.user.id },
        data: { twoFactorVerified: new Date().toISOString() },
      })
      return res.json({ success: true, method: 'totp' })
    }

    // Verify backup code
    if (method === 'backup' && backupCode) {
      const hashedCodes: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : []
      const idx = hashedCodes.findIndex(h => h !== 'USED' && verifyBackupCode(backupCode, [h]))
      if (idx === -1) return res.status(400).json({ error: 'Invalid backup code' })
      hashedCodes[idx] = 'USED'
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          backupCodes: JSON.stringify(hashedCodes),
          twoFactorVerified: new Date().toISOString(),
        },
      })
      return res.json({
        success: true, method: 'backup',
        remainingCodes: hashedCodes.filter(c => c !== 'USED').length,
      })
    }

    return res.status(400).json({ error: 'Invalid method or missing code' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
