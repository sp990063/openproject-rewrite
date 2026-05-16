import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Group, GroupMembership, User } from '@prisma/client'

type GroupWithCount = Group & { _count: { members: number } }

export function useGroups() {
  return useQuery<GroupWithCount[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await fetch('/api/groups')
      if (!res.ok) throw new Error('Failed to fetch groups')
      return res.json()
    },
  })
}

export function useGroup(id: string) {
  return useQuery<Group & { members: (GroupMembership & { user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> })[] }>({
    queryKey: ['groups', id],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${id}`)
      if (!res.ok) throw new Error('Failed to fetch group')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create group')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update group')
      }
      return res.json()
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups', id] })
    },
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete group')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useAddGroupMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to add member')
      }
      return res.json()
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
    },
  })
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const res = await fetch(`/api/groups/${groupId}/members?userId=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to remove member')
      }
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] })
    },
  })
}
