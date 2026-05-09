/**
 * pages/api/ldap/sync.ts
 * Manual LDAP user/group synchronization endpoint.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/prisma'
import { authOptions } from '../../../lib/auth'
import { syncLdapUser, fullSync } from '../../../lib/ldap/sync'

export default async function ldapSyncHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.isSystemAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    return syncUser(req, res)
  } else if (req.method === 'GET') {
    return triggerFullSync(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * POST /api/ldap/sync
 * Sync a specific user from LDAP.
 */
async function syncUser(req: NextApiRequest, res: NextApiResponse) {
  const { username, password, ldapServerId } = req.body

  if (!username || !password || !ldapServerId) {
    return res.status(400).json({ error: 'Username, password, and LDAP server ID are required' })
  }

  const server = await prisma.ldapServer.findUnique({
    where: { id: ldapServerId },
    include: { mappings: true },
  })

  if (!server) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  if (!server.enabled) {
    return res.status(400).json({ error: 'LDAP server is disabled' })
  }

  const result = await syncLdapUser(server, username, password, server.mappings)

  if (!result.success) {
    return res.status(400).json({ error: result.error })
  }

  return res.status(200).json(result)
}

/**
 * GET /api/ldap/sync
 * Trigger a full LDAP sync (admin only).
 */
async function triggerFullSync(req: NextApiRequest, res: NextApiResponse) {
  const { ldapServerId } = req.query

  if (typeof ldapServerId !== 'string') {
    return res.status(400).json({ error: 'LDAP server ID is required' })
  }

  const server = await prisma.ldapServer.findUnique({
    where: { id: ldapServerId },
    include: { mappings: true },
  })

  if (!server) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  if (!server.enabled) {
    return res.status(400).json({ error: 'LDAP server is disabled' })
  }

  // Full sync returns synced count and any errors
  const result = await fullSync(server, server.mappings)

  return res.status(200).json(result)
}
