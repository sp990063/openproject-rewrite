/**
 * pages/api/ldap/mappings/[id].ts
 * Single mapping operations (GET, PUT, DELETE).
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { prisma } from '../../../../lib/prisma'
import { authOptions } from '../../../../lib/auth'

export default async function ldapMappingHandler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.isSystemAdmin) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid mapping ID' })
  }

  switch (req.method) {
    case 'GET':
      return getMapping(req, res, id)
    case 'PUT':
      return updateMapping(req, res, id)
    case 'DELETE':
      return deleteMapping(req, res, id)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function getMapping(req: NextApiRequest, res: NextApiResponse, id: string) {
  const mapping = await prisma.ldapGroupMapping.findUnique({
    where: { id },
    include: {
      ldapServer: {
        select: { id: true, name: true },
      },
    },
  })

  if (!mapping) {
    return res.status(404).json({ error: 'Mapping not found' })
  }

  return res.status(200).json(mapping)
}

async function updateMapping(req: NextApiRequest, res: NextApiResponse, id: string) {
  const existing = await prisma.ldapGroupMapping.findUnique({ where: { id } })

  if (!existing) {
    return res.status(404).json({ error: 'Mapping not found' })
  }

  const { ldapGroupDn, ldapGroupName, localRoleId } = req.body

  const updateData: Record<string, unknown> = {}

  if (ldapGroupDn !== undefined) updateData.ldapGroupDn = ldapGroupDn
  if (ldapGroupName !== undefined) updateData.ldapGroupName = ldapGroupName
  if (localRoleId !== undefined) updateData.localRoleId = localRoleId

  const mapping = await prisma.ldapGroupMapping.update({
    where: { id },
    data: updateData,
  })

  return res.status(200).json(mapping)
}

async function deleteMapping(req: NextApiRequest, res: NextApiResponse, id: string) {
  const existing = await prisma.ldapGroupMapping.findUnique({ where: { id } })

  if (!existing) {
    return res.status(404).json({ error: 'Mapping not found' })
  }

  await prisma.ldapGroupMapping.delete({ where: { id } })

  return res.status(204).send(null)
}
