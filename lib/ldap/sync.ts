// lib/ldap/sync.ts — LDAP user/group sync engine
import { createLdapClient, bindClient, searchUsers, searchGroups, unbindClient } from './client'
import type { LdapConfig, LdapUser } from './client'
import { prisma } from '@/lib/prisma'

export interface SyncResult {
  usersCreated: number
  usersUpdated: number
  groupsMapped: number
  errors: string[]
}

export async function syncLdapUsers(config: LdapConfig): Promise<LdapUser[]> {
  const client = createLdapClient(config)
  try {
    if (config.bindDn && config.bindPassword) {
      await bindClient(client, config.bindDn, config.bindPassword)
    }
    return await searchUsers(client, config.baseDn, '(objectClass=inetOrgPerson)', ['uid', 'mail', 'cn', 'memberOf', 'displayName'])
  } finally {
    unbindClient(client)
  }
}

export async function syncLdapGroups(config: LdapConfig): Promise<any[]> {
  const client = createLdapClient(config)
  try {
    if (config.bindDn && config.bindPassword) {
      await bindClient(client, config.bindDn, config.bindPassword)
    }
    return await searchGroups(client, config.baseDn, '(objectClass=groupOfNames)', ['cn', 'member', 'description'])
  } finally {
    unbindClient(client)
  }
}

export async function syncLdapToLocal(ldapServerId: string): Promise<SyncResult> {
  const server = await prisma.ldapServer.findUnique({ where: { id: ldapServerId } })
  if (!server) throw new Error('LDAP server not found')

  const config: LdapConfig = {
    url: server.url,
    baseDn: server.baseDn,
    bindDn: server.bindDn ?? undefined,
    bindPassword: server.bindPassword ?? undefined,
  }

  const result: SyncResult = { usersCreated: 0, usersUpdated: 0, groupsMapped: 0, errors: [] }

  try {
    const ldapUsers = await syncLdapUsers(config)
    const ldapGroups = await syncLdapGroups(config)

    for (const lu of ldapUsers) {
      if (!lu.mail) continue
      const existing = await prisma.user.findFirst({ where: { email: lu.mail } })
      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: { name: lu.cn ?? lu.displayName ?? lu.mail } })
        result.usersUpdated++
      } else {
        await prisma.user.create({
          data: {
            email: lu.mail,
            name: lu.cn ?? lu.displayName ?? lu.mail,
            authProvider: 'ldap',
            authProviderId: lu.uid ?? lu.mail,
          },
        })
        result.usersCreated++
      }
    }

    const mappings = await prisma.ldapGroupMapping.findMany({ where: { ldapServerId } })
    for (const mapping of mappings) {
      if (ldapGroups.some(g => g.cn === mapping.ldapGroupName)) result.groupsMapped++
    }
  } catch (e: any) {
    result.errors.push(e.message)
  }

  return result
}
