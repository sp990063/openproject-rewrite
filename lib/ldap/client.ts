// lib/ldap/client.ts — LDAP client wrapper
import { createClient, Client, SearchOptions } from 'ldapjs'

export interface LdapConfig {
  url: string
  port?: number
  baseDn: string
  bindDn?: string
  bindPassword?: string
  tlsOptions?: { rejectUnauthorized?: boolean }
}

export interface LdapUser {
  dn: string
  uid?: string
  mail?: string
  cn?: string
  memberOf?: string[]
  displayName?: string
}

export function createLdapClient(config: LdapConfig): Client {
  const url = config.url.includes('://') ? config.url : `ldap://${config.url}:${config.port ?? 389}`
  return createClient({ url, tlsOptions: config.tlsOptions })
}

export async function bindClient(client: Client, bindDn: string, bindPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(bindDn, bindPassword, (err: Error | null) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export async function searchUsers(
  client: Client,
  baseDn: string,
  filter: string,
  attributes: string[]
): Promise<LdapUser[]> {
  return new Promise((resolve, reject) => {
    const opts: SearchOptions = { filter, attributes, scope: 'sub' }
    const entries: LdapUser[] = []
    const res = client.search(baseDn, opts)
    res.on('searchEntry', (entry: any) => {
      const obj: any = { dn: entry.dn?.toString() ?? '' }
      entry.attributes?.forEach?.((attr: any) => {
        obj[attr.type] = attr.values?.[0] ?? attr._vals?.[0] ?? null
      })
      entries.push(obj as LdapUser)
    })
    res.on('error', (searchErr: Error) => reject(searchErr))
    res.on('end', () => resolve(entries))
  })
}

export async function searchGroups(
  client: Client,
  baseDn: string,
  filter: string,
  attributes: string[]
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const opts: SearchOptions = { filter, attributes, scope: 'sub' }
    const entries: any[] = []
    const res = client.search(baseDn, opts)
    res.on('searchEntry', (entry: any) => {
      const obj: any = { dn: entry.dn?.toString() ?? '' }
      entry.attributes?.forEach?.((attr: any) => {
        obj[attr.type] = attr.values?.[0] ?? attr._vals?.[0] ?? null
      })
      entries.push(obj)
    })
    res.on('error', (searchErr: Error) => reject(searchErr))
    res.on('end', () => resolve(entries))
  })
}

export function unbindClient(client: Client): void {
  client.unbind(() => {})
}

// Test LDAP connection
export async function testConnection(config: LdapConfig): Promise<{ success: boolean; error?: string }> {
  const client = createLdapClient(config)
  try {
    if (config.bindDn && config.bindPassword) {
      await bindClient(client, config.bindDn, config.bindPassword)
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Connection failed' }
  } finally {
    unbindClient(client)
  }
}

// Authenticate user against LDAP
export async function authenticateUser(
  config: LdapConfig,
  username: string,
  password: string
): Promise<{ success: boolean; user?: LdapUser; error?: string }> {
  const client = createLdapClient(config)
  try {
    if (config.bindDn && config.bindPassword) {
      await bindClient(client, config.bindDn, config.bindPassword)
    }

    // Search for the user
    const filter = config.userFilter?.replace('${username}', username) ?? `(uid=${username})`
    const attributes = ['uid', 'mail', 'cn', 'memberOf', 'displayName']
    const users = await searchUsers(client, config.baseDn, filter, attributes)

    if (users.length === 0) {
      return { success: false, error: 'User not found' }
    }

    const ldapUser = users[0]

    // Attempt to bind as the user to verify password
    if (ldapUser.dn && password) {
      const userClient = createLdapClient(config)
      try {
        await bindClient(userClient, ldapUser.dn, password)
        return { success: true, user: ldapUser }
      } catch {
        return { success: false, error: 'Invalid credentials' }
      } finally {
        unbindClient(userClient)
      }
    }

    return { success: true, user: ldapUser }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Authentication failed' }
  } finally {
    unbindClient(client)
  }
}
