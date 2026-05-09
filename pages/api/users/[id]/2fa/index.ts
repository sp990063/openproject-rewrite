// pages/api/users/[id]/2fa/index.ts — Get 2FA status
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpEnabled: true,
      totpSecret: true,
      backupCodes: true,
      webAuthnCreds: true,
    },
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  let backupCodesRemaining = 0
  if (user.backupCodes) {
    const codes: Array<{ used: boolean }> = JSON.parse(user.backupCodes)
    backupCodesRemaining = codes.filter(c => !c.used).length
  }

  return res.status(200).json({
    totpEnabled: user.totpEnabled,
    webAuthnEnabled: !!(user.webAuthnCreds && JSON.parse(user.webAuthnCreds).length > 0),
    backupCodesRemaining,
  })
}
