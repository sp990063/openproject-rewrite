// lib/ldap/client.ts — LDAP client wrapper
// SEC-4 (Phase 0): RFC 4515 filter escaping to prevent LDAP injection.
// e.g. an attacker username `*)(uid=*` could bypass authentication filters
// or bind as an unintended user. All user-controlled values are escaped
// before being interpolated into search filters, and the search-derived
// bind DN is validated before being used to authenticate.
import { createClient, Client, SearchOptions, parseDN } from 'ldapjs'
import { recordSecurityEvent } from '@/lib/security/audit'

export interface LdapConfig {
  url: string
  port?: number
  baseDn: string
  bindDn?: string
  bindPassword?: string
  tlsOptions?: { rejectUnauthorized?: boolean }
  userFilter?: string
}

export interface LdapUser {
  dn: string
  uid?: string
  mail?: string
  cn?: string
  memberOf?: string[]
  displayName?: string
}

// Hard cap to prevent trivial DoS / log poisoning via huge usernames.
const MAX_USERNAME_LEN = 256

/**
 * RFC 4515 §3 escape for filter assertion values. Escapes the four
 * metacharacters `\`, `*`, `(`, `)` plus NUL. We do NOT use ldapjs's
 * own escape because it has historically been exposed only via
 * `ldapjs/lib/filters/escape` (deep import) — implementing here gives
 * us a stable surface.
 */
export function escapeLdapFilterValue(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c === 0x5c /* \ */ || c === 0x2a /* * */ || c === 0x28 /* ( */ || c === 0x29 /* ) */) {
      out += '\\' + c.toString(16).padStart(2, '0')
    } else if (c === 0x00) {
      out += '\\00'
    } else {
      out += input[i]
    }
  }
  return out
}

function assertSafeUsername(username: string): void {
  if (typeof username !== 'string' || username.length === 0) {
    throw new Error('Invalid username')
  }
  if (username.length > MAX_USERNAME_LEN) {
    throw new Error('Username too long')
  }
  // Reject control characters outright — RFC 4515 forbids them inside filter
  // assertions; rejecting here gives us a defense-in-depth layer that survives
  // any future bugs in escapeLdapFilterValue.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f]/.test(username)) {
    throw new Error('Invalid characters in username')
  }
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

/**
 * Authenticate a user against LDAP.
 *
 * SEC-4: This function previously interpolated `username` directly into a
 * filter string (`(uid=${username})`), which is an LDAP injection vector —
 * an attacker submitting `*)(uid=*` could match any user. The fix is
 * RFC 4515 filter escaping (see `escapeLdapFilterValue`) and a defensive
 * input check that rejects control characters and unbounded length.
 *
 * The bind DN is the server-returned DN, never user input, and we validate
 * that it parses as a DN before using it.
 */
export async function authenticateUser(
  config: LdapConfig,
  username: string,
  password: string
): Promise<{ success: boolean; user?: LdapUser; error?: string }> {
  assertSafeUsername(username)

  const client = createLdapClient(config)
  try {
    if (config.bindDn && config.bindPassword) {
      await bindClient(client, config.bindDn, config.bindPassword)
    }

    // RFC 4515 §3 — escape `\` `*` `(` `)` NUL before interpolation.
    // The default filter is hard-coded; user-controlled `${username}` placeholder
    // is replaced with an escaped value.
    const filterTemplate = config.userFilter ?? '(uid=${username})'
    const escaped = escapeLdapFilterValue(username)
    const filter = filterTemplate.replace('${username}', escaped)

    const attributes = ['uid', 'mail', 'cn', 'memberOf', 'displayName']
    const users = await searchUsers(client, config.baseDn, filter, attributes)

    if (users.length === 0) {
      // Don't reveal whether the user exists; do log it for security review.
      await recordSecurityEvent({
        type: 'LDAP_AUTH_USER_NOT_FOUND',
        ip: null,
        userId: null,
        meta: { usernameHash: hashForLog(username) },
      }).catch(() => { /* best-effort */ })
      return { success: false, error: 'Invalid credentials' }
    }

    if (users.length > 1) {
      // Ambiguous match — refuse to authenticate.
      await recordSecurityEvent({
        type: 'LDAP_AUTH_AMBIGUOUS_MATCH',
        ip: null,
        userId: null,
        meta: { matchCount: users.length, usernameHash: hashForLog(username) },
      }).catch(() => { /* best-effort */ })
      return { success: false, error: 'Invalid credentials' }
    }

    const ldapUser = users[0]

    // Validate that the returned DN is a well-formed DN before using it as
    // a bind target. Catches malformed or hostile values returned by a
    // misconfigured / malicious directory.
    try {
      parseDN(ldapUser.dn)
    } catch {
      await recordSecurityEvent({
        type: 'LDAP_AUTH_INVALID_DN',
        ip: null,
        userId: null,
        meta: { dn: ldapUser.dn.slice(0, 256) },
      }).catch(() => { /* best-effort */ })
      return { success: false, error: 'Invalid credentials' }
    }

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

// Best-effort username hashing for security event logs — never log the raw username.
function hashForLog(input: string): string {
  // SHA-256 hex prefix is sufficient for correlation; not for crypto.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require('crypto') as typeof import('crypto')
  return createHash('sha256').update(input).digest('hex').slice(0, 12)
}
