import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createTotpSecret, generateTotpToken, generateTotpUri } from '@/lib/2fa/totp'
import { generateBackupCodes, hashBackupCode } from '@/lib/2fa/backup-codes'
import { verifyTotpToken } from '@/lib/2fa/totp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST') {
    const { action } = req.body

    if (action === 'generate') {
      const secret = createTotpSecret()
      const token = generateTotpToken(secret)
      const uri = generateTotpUri(secret, session.user.email ?? session.user.name ?? 'user')
      const backupCodes = generateBackupCodes()
      const hashedCodes = backupCodes.map(c => hashBackupCode(c))

      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpSecret: secret, backupCodes: JSON.stringify(hashedCodes) },
      })

      return res.json({ secret, token, uri, backupCodes })
    }

    if (action === 'enable') {
      const { token } = req.body
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { totpSecret: true },
      })
      if (!user?.totpSecret) return res.status(400).json({ error: 'No pending setup' })

      const valid = verifyTotpToken(token, user.totpSecret)
      if (!valid) return res.status(400).json({ error: 'Invalid code' })

      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: true },
      })
      return res.json({ success: true })
    }

    if (action === 'disable') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: false, totpSecret: null, backupCodes: null, twoFactorVerified: null },
      })
      return res.json({ success: true })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
