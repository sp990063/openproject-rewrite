import { useQuery } from '@tanstack/react-query'
import type { SearchParams, SearchResponse } from '@/types'

async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('q', params.q)
  if (params.projectId) searchParams.set('projectId', params.projectId)
  if (params.types?.length) searchParams.set('types', params.types.join(','))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const url = `/api/search?${searchParams}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export function useSearch(params: SearchParams, enabled = true) {
  return useQuery({
    queryKey: ['search', params.q, params.projectId, params.types, params.limit, params.offset],
    queryFn: () => fetchSearch(params),
    enabled: enabled && params.q.trim().length > 0,
    staleTime: 1000 * 60, // 1 minute
  })
}
