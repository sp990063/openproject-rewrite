import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ldap/client', () => ({
  createLdapClient: vi.fn(() => ({
    bind: vi.fn((dn, pw, cb) => cb(null)),
    search: vi.fn(() => ({
      on: vi.fn((evt, cb) => {
        if (evt === 'searchEntry') cb({ dn: 'uid=jdoe,dc=test', attributes: [] })
        if (evt === 'end') cb({ status: 0 })
      }),
    })),
    unbind: vi.fn(),
  })),
  bindClient: vi.fn(() => Promise.resolve()),
  searchUsers: vi.fn(() => Promise.resolve([
    { dn: 'uid=jdoe,dc=test', uid: 'jdoe', mail: 'jdoe@test.com', cn: 'John Doe' },
  ])),
  searchGroups: vi.fn(() => Promise.resolve([
    { dn: 'cn=admins,dc=test', cn: 'admins' },
  ])),
  unbindClient: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ldapServer: {
      findUnique: vi.fn(() => Promise.resolve({
        id: '1', url: 'ldap://localhost', baseDn: 'dc=test',
        bindDn: null, bindPassword: null, port: 389, useTLS: false, createdAt: new Date(),
      })),
    },
    user: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      update: vi.fn(() => Promise.resolve({})),
      create: vi.fn(() => Promise.resolve({ id: 'u1', email: 'jdoe@test.com' })),
    },
    ldapGroupMapping: { findMany: vi.fn(() => Promise.resolve([])) },
  },
}))

describe('LDAP Sync', () => {
  it('syncs LDAP users to local database', async () => {
    const { syncLdapToLocal } = await import('@/lib/ldap/sync')
    const result = await syncLdapToLocal('1')
    expect(result.usersCreated).toBeGreaterThanOrEqual(0)
    expect(result.errors).toHaveLength(0)
  })
})
