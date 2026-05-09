// lib/ldap/group-map.ts — LDAP group-to-role mapping
import { prisma } from '@/lib/prisma'

export async function getGroupMappings(ldapServerId: string) {
  return prisma.ldapGroupMapping.findMany({
    where: { ldapServerId },
    include: { ldapServer: true },
  })
}

export async function createGroupMapping(
  ldapServerId: string,
  ldapGroupDn: string,
  ldapGroupName: string,
  localRoleId: string
) {
  return prisma.ldapGroupMapping.create({
    data: { ldapServerId, ldapGroupDn, ldapGroupName, localRoleId },
  })
}

export async function deleteGroupMapping(id: string) {
  return prisma.ldapGroupMapping.delete({ where: { id } })
}
