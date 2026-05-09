import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectMember } from '@/types/project'

export function useMemberMutations(projectId: string) {
  const queryClient = useQueryClient()

  const addMember = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }): Promise<ProjectMember> => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleId }),
      })
      if (!res.ok) throw new Error('Failed to add member')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  })

  const updateMemberRole = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string }): Promise<ProjectMember> => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, roleId }),
      })
      if (!res.ok) throw new Error('Failed to update member')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string): Promise<void> => {
      const res = await fetch(`/api/projects/${projectId}/members?memberId=${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove member')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }),
  })

  return { addMember, updateMemberRole, removeMember }
}
