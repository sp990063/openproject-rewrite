/**
 * pages/api/ldap/servers/[id].ts
 * Single LDAP server operations (GET, PUT, DELETE, POST for test).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/prisma'
import { authOptions } from '../../../../lib/auth'
import { testConnection } from '../../../../lib/ldap/client'

export default async function ldapServerHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.isSystemAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid server ID' })
  }

  switch (req.method) {
    case 'GET':
      return getServer(req, res, id)
    case 'PUT':
      return updateServer(req, res, id)
    case 'DELETE':
      return deleteServer(req, res, id)
    case 'POST':
      return testServer(req, res, id)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getServer(req: NextApiRequest, res: NextApiResponse, id: string) {
  const server = await prisma.ldapServer.findUnique({
    where: { id },
    include: { mappings: true },
  })

  if (!server) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  return res.status(200).json({
    ...server,
    bindPassword: undefined,
  })
}

async function updateServer(req: NextApiRequest, res: NextApiResponse, id: string) {
  const existing = await prisma.ldapServer.findUnique({ where: { id } })

  if (!existing) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

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

  const updateData: Record<string, unknown> = {}

  if (name !== undefined) updateData.name = name
  if (host !== undefined) updateData.host = host
  if (port !== undefined) updateData.port = port
  if (useSsl !== undefined) updateData.useSsl = useSsl
  if (bindDn !== undefined) updateData.bindDn = bindDn
  if (baseDn !== undefined) updateData.baseDn = baseDn
  if (userFilter !== undefined) updateData.userFilter = userFilter
  if (emailAttribute !== undefined) updateData.emailAttribute = emailAttribute
  if (nameAttribute !== undefined) updateData.nameAttribute = nameAttribute
  if (groupFilter !== undefined) updateData.groupFilter = groupFilter
  if (groupAttribute !== undefined) updateData.groupAttribute = groupAttribute
  if (enabled !== undefined) updateData.enabled = enabled
  if (autoSync !== undefined) updateData.autoSync = autoSync
  if (syncInterval !== undefined) updateData.syncInterval = syncInterval

  // Only update bindPassword if provided
  if (bindPassword) {
    updateData.bindPassword = bindPassword
  }

  const server = await prisma.ldapServer.update({
    where: { id },
    data: updateData,
  })

  return res.status(200).json({
    ...server,
    bindPassword: undefined,
  })
}

async function deleteServer(req: NextApiRequest, res: NextApiResponse, id: string) {
  const existing = await prisma.ldapServer.findUnique({ where: { id } })

  if (!existing) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  await prisma.ldapServer.delete({ where: { id } })

  return res.status(204).send(null)
}

async function testServer(req: NextApiRequest, res: NextApiResponse, id: string) {
  const server = await prisma.ldapServer.findUnique({ where: { id } })

  if (!server) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  const result = await testConnection(server)

  if (result.success) {
    return res.status(200).json({ success: true, message: 'Connection successful' })
  } else {
    return res.status(200).json({ success: false, error: result.error })
  }
}
