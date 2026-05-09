import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ModuleType } from '@/types/project'

export function useModuleMutations(projectId: string) {
  const queryClient = useQueryClient()

  const updateModules = useMutation({
    mutationFn: async (modules: Array<{ module: ModuleType; enabled: boolean }>): Promise<void> => {
      const res = await fetch(`/api/projects/${projectId}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      if (!res.ok) throw new Error('Failed to update modules')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  return { updateModules }
}
