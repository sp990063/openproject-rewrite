import { useQuery } from '@tanstack/react-query'
import type { ProjectMember } from '@/types/project'

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: async (): Promise<ProjectMember[]> => {
      const res = await fetch(`/api/projects/${projectId}/members`)
      if (!res.ok) throw new Error('Failed to fetch members')
      return res.json()
    },
    enabled: !!projectId,
  })
}
