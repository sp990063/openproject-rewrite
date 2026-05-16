import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) {
    return res.status(403).json({ error: 'Admin only' })
  }

  if (req.method === 'GET') {
    const googleClientId = await prisma.setting.findUnique({ where: { key: 'google_client_id' } })
    const googleClientSecret = await prisma.setting.findUnique({ where: { key: 'google_client_secret' } })

    return res.json({
      googleClientId: googleClientId?.value ?? '',
      googleClientSecret: googleClientSecret?.value ?? '',
      isConfigured: !!(googleClientId?.value && googleClientSecret?.value),
    })
  }

  if (req.method === 'PUT') {
    const { googleClientId, googleClientSecret } = req.body

    await prisma.setting.upsert({
      where: { key: 'google_client_id' },
      update: { value: googleClientId ?? '' },
      create: { key: 'google_client_id', value: googleClientId ?? '' },
    })

    await prisma.setting.upsert({
      where: { key: 'google_client_secret' },
      update: { value: googleClientSecret ?? '' },
      create: { key: 'google_client_secret', value: googleClientSecret ?? '' },
    })

    return res.json({
      success: true,
      isConfigured: !!(googleClientId && googleClientSecret),
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
