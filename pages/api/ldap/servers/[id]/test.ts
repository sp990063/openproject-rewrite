import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import { createLdapClient, bindClient, searchUsers, unbindClient } from '@/lib/ldap/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) return res.status(403).json({ error: 'Admin only' })

  const { id } = req.query
  const server = await prisma.ldapServer.findUnique({ where: { id: id as string } })
  if (!server) return res.status(404).json({ error: 'Server not found' })

  if (req.method !== 'POST') return res.status(405).end()

  const client = createLdapClient({ url: server.url, port: server.port, baseDn: server.baseDn })
  try {
    await bindClient(client, server.bindDn ?? '', server.bindPassword ?? '')
    const users = await searchUsers(client, server.baseDn, '(objectClass=*)', ['uid', 'mail', 'cn'])
    unbindClient(client)
    return res.json({ success: true, userCount: users.length })
  } catch (e: any) {
    unbindClient(client)
    return res.status(400).json({ success: false, error: e.message })
  }
}
