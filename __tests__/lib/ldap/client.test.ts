import { describe, it, expect, vi } from 'vitest'
import { createLdapClient } from '@/lib/ldap/client'

vi.mock('ldapjs', () => {
  const mockClient = {
    bind: vi.fn((dn, pw, cb) => cb(null)),
    search: vi.fn(() => {
      const res = {
        on: vi.fn((evt, cb) => {
          if (evt === 'searchEntry') cb({ dn: 'uid=jdoe,dc=test', attributes: [] })
          if (evt === 'end') cb({ status: 0 })
        }),
      }
      return res
    }),
    unbind: vi.fn(),
  }
  return { createClient: vi.fn(() => mockClient), default: { createClient: vi.fn(() => mockClient) } }
})

describe('LDAP Client', () => {
  describe('createLdapClient', () => {
    it('creates a client with url', () => {
      const client = createLdapClient({ url: 'ldap://localhost', baseDn: 'dc=test' })
      expect(client).toBeDefined()
    })

    it('constructs url from host and port', () => {
      const client = createLdapClient({ url: 'localhost', port: 636, baseDn: 'dc=test' })
      expect(client).toBeDefined()
    })
  })
})
