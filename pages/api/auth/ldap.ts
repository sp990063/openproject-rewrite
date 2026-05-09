/**
 * pages/api/auth/ldap.ts
 * LDAP authentication endpoint for NextAuth.js credentials flow.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/prisma'
import { authenticateUser } from '../../../lib/ldap/client'
import { syncLdapUser } from '../../../lib/ldap/sync'
import { authOptions } from '../../../lib/auth'

export default async function ldapAuthHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username, password, ldapServerId } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' })
  }

  // Get the LDAP server configuration
  if (!ldapServerId) {
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

  // Authenticate and sync user
  const syncResult = await syncLdapUser(server, username, password, server.mappings)

  if (!syncResult.success) {
    return res.status(401).json({ error: syncResult.error ?? 'Authentication failed' })
  }

  // Get the local user after sync
  const user = await prisma.user.findUnique({
    where: { id: syncResult.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      isSystemAdmin: true,
      passwordMigrationRequired: true,
    },
  })

  if (!user) {
    return res.status(500).json({ error: 'User not found after sync' })
  }

  // Return user data for NextAuth to create a session
  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isSystemAdmin: user.isSystemAdmin,
      passwordMigrationRequired: user.passwordMigrationRequired,
    },
  })
}
