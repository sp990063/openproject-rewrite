import { useQuery, useInfiniteQuery } from '@tanstack/react-query'

export interface ActivityItem {
  id: string
  projectId: string
  userId: string
  user?: { id: string; name: string; avatarUrl?: string }
  subjectType: string
  subjectId: string
  action: string
  details?: Record<string, unknown>
  reference?: { title?: string; type?: string }
  createdAt: string
  comment?: string
  commentCount?: number
}

interface ActivityFilters {
  type?: string // 'work_package' | 'wiki' | 'forum' | 'meeting' | 'document' | 'news'
  page?: number
  limit?: number
}

async function fetchActivity(projectId: string, filters: ActivityFilters = {}): Promise<{
  data: ActivityItem[]
  total: number
  page: number
  totalPages: number
}> {
  const params = new URLSearchParams()
  if (filters.type) params.set('filter', filters.type)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  const res = await fetch(`/api/projects/${projectId}/activity?${params}`)
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json()
}

export function useActivity(projectId: string | undefined, filters: ActivityFilters = {}) {
  return useQuery({
    queryKey: ['activity', projectId, filters],
    queryFn: () => fetchActivity(projectId!, filters),
    enabled: !!projectId,
    refetchInterval: 30000, // Refresh every 30s
  })
}

export function useInfiniteActivity(projectId: string | undefined, filters: ActivityFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['activity', 'infinite', projectId, filters],
    queryFn: ({ pageParam = 1 }) => fetchActivity(projectId!, { ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: !!projectId,
  })
}
