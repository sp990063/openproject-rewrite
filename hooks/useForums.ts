import { useQuery } from '@tanstack/react-query'
import type { Forum } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// Response type with relations (API shape)
interface ForumWithDetails {
  id: string
  projectId: string
  name: string
  description: string | null
  authorId: string
  createdAt: Date
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  _count: { threads: number }
}

async function fetchForums(projectId: string): Promise<ForumWithDetails[]> {
  const res = await fetch(`/api/projects/${projectId}/forums`)
  if (!res.ok) throw new Error('Failed to fetch forums')
  return res.json()
}

export function useForums(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.forums(projectId ?? ''),
    queryFn: () => fetchForums(projectId!),
    enabled: !!projectId,
  })
}
