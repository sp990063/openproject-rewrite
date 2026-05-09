import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { syncLdapToLocal } from '@/lib/ldap/sync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) return res.status(403).json({ error: 'Admin only' })

  if (req.method !== 'POST') return res.status(405).end()

  const { id } = req.query
  try {
    const result = await syncLdapToLocal(id as string)
    return res.json({ success: true, ...result })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message })
  }
}
