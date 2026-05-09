import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProjectWipLimit } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

export interface WipLimitInput {
  statusId: string
  limit: number | null
}

export function useWipLimits(projectId: string) {
  return useQuery<ProjectWipLimit[]>({
    queryKey: queryKeys.wipLimits(projectId),
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/wip-limits`)
      if (!res.ok) throw new Error('Failed to fetch WIP limits')
      return res.json()
    },
    enabled: !!projectId,
  })
}

export function useUpdateWipLimit(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: WipLimitInput) => {
      const res = await fetch(`/api/projects/${projectId}/wip-limits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to update WIP limit')
      return res.json() as Promise<ProjectWipLimit>
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ProjectWipLimit[]>(
        queryKeys.wipLimits(projectId),
        (old) => {
          if (!old) return [data]
          const idx = old.findIndex((l) => l.statusId === data.statusId)
          if (idx >= 0) {
            const next = [...old]
            next[idx] = data
            return next
          }
          return [...old, data]
        }
      )
    },
  })
}
