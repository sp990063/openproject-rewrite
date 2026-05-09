/**
 * pages/api/ldap/mappings.ts
 * CRUD operations for LDAP group mappings.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../lib/prisma'
import { authOptions } from '../../../lib/auth'

export default async function ldapMappingsHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.isSystemAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  switch (req.method) {
    case 'GET':
      return getMappings(req, res)
    case 'POST':
      return createMapping(req, res)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getMappings(req: NextApiRequest, res: NextApiResponse) {
  const { ldapServerId } = req.query

  if (typeof ldapServerId !== 'string') {
    return res.status(400).json({ error: 'LDAP server ID is required' })
  }

  const mappings = await prisma.ldapGroupMapping.findMany({
    where: { ldapServerId },
    include: {
      ldapServer: {
        select: { id: true, name: true },
      },
    },
    orderBy: { ldapGroupName: 'asc' },
  })

  return res.status(200).json(mappings)
}

async function createMapping(req: NextApiRequest, res: NextApiResponse) {
  const { ldapServerId, ldapGroupDn, ldapGroupName, localRoleId } = req.body

  if (!ldapServerId || !ldapGroupDn || !ldapGroupName || !localRoleId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Verify the LDAP server exists
  const server = await prisma.ldapServer.findUnique({
    where: { id: ldapServerId },
  })

  if (!server) {
    return res.status(404).json({ error: 'LDAP server not found' })
  }

  // Verify the role exists
  const role = await prisma.role.findUnique({
    where: { id: localRoleId },
  })

  if (!role) {
    return res.status(404).json({ error: 'Role not found' })
  }

  const mapping = await prisma.ldapGroupMapping.create({
    data: {
      ldapServerId,
      ldapGroupDn,
      ldapGroupName,
      localRoleId,
    },
  })

  return res.status(201).json(mapping)
}
