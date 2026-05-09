/**
 * pages/api/ldap/servers.ts
 * CRUD operations for LDAP servers.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/prisma'
import { authOptions } from '../../../lib/auth'
import { testConnection } from '../../../lib/ldap/client'

export default async function ldapServersHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.isSystemAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return getServers(req, res)
    case 'POST':
      return createServer(req, res)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getServers(req: NextApiRequest, res: NextApiResponse) {
  const servers = await prisma.ldapServer.findMany({
    include: {
      mappings: {
        include: {
          ldapServer: false,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Don't expose bind passwords
  const sanitized = servers.map((s) => ({
    ...s,
    bindPassword: undefined,
  }))

  return res.status(200).json(sanitized)
}

async function createServer(req: NextApiRequest, res: NextApiResponse) {
  const {
    name,
    host,
    port,
    useSsl,
    bindDn,
    bindPassword,
    baseDn,
    userFilter,
    emailAttribute,
    nameAttribute,
    groupFilter,
    groupAttribute,
    enabled,
    autoSync,
    syncInterval,
  } = req.body

  if (!name || !host || !port || !bindDn || !bindPassword || !baseDn) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const server = await prisma.ldapServer.create({
    data: {
      name,
      host,
      port: port || 389,
      useSsl: useSsl ?? true,
      bindDn,
      bindPassword,
      baseDn,
      userFilter: userFilter || '(objectClass=user)',
      emailAttribute: emailAttribute || 'mail',
      nameAttribute: nameAttribute || 'cn',
      groupFilter: groupFilter || '(objectClass=group)',
      groupAttribute: groupAttribute || 'member',
      enabled: enabled ?? true,
      autoSync: autoSync ?? false,
      syncInterval: syncInterval || 60,
    },
  })

  return res.status(201).json({
    ...server,
    bindPassword: undefined,
  })
}
