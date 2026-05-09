import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.isSystemAdmin) return res.status(403).json({ error: 'Admin only' })

  if (req.method === 'GET') {
    const servers = await prisma.ldapServer.findMany({ include: { mappings: true } })
    return res.json({ servers })
  }

  if (req.method === 'POST') {
    const { name, url, port, baseDn, bindDn, bindPassword, useTLS } = req.body
    if (!name || !url || !baseDn) return res.status(400).json({ error: 'Missing required fields' })
    const encrypted = bindPassword ? crypto.createHash('sha256').update(bindPassword).digest('hex') : null
    const server = await prisma.ldapServer.create({
      data: {
        name,
        url,
        port: port ?? 389,
        baseDn,
        bindDn: bindDn ?? null,
        bindPassword: encrypted,
        useTLS: useTLS ?? false,
      },
    })
    return res.json({ server })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
