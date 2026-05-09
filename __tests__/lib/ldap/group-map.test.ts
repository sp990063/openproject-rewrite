import { describe, it, expect, vi } from 'vitest'
import { getGroupMappings, createGroupMapping, deleteGroupMapping } from '@/lib/ldap/group-map'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ldapGroupMapping: {
      findMany: vi.fn(() => Promise.resolve([
        { id: 'm1', ldapServerId: 's1', ldapGroupDn: 'cn=admins,dc=test', ldapGroupName: 'admins', localRoleId: 'role1' },
      ])),
      create: vi.fn((data) => Promise.resolve({ id: 'm2', ...data.data })),
      delete: vi.fn(() => Promise.resolve({})),
    },
  },
}))

describe('LDAP Group Mapping', () => {
  describe('getGroupMappings', () => {
    it('returns mappings for server', async () => {
      const mappings = await getGroupMappings('s1')
      expect(mappings).toHaveLength(1)
      expect(mappings[0].ldapGroupName).toBe('admins')
    })
  })

  describe('createGroupMapping', () => {
    it('creates a mapping', async () => {
      const mapping = await createGroupMapping('s1', 'cn=devs,dc=test', 'devs', 'role2')
      expect(mapping.ldapGroupName).toBe('devs')
    })
  })

  describe('deleteGroupMapping', () => {
    it('deletes a mapping', async () => {
      await expect(deleteGroupMapping('m1')).resolves.toBeDefined()
    })
  })
})
