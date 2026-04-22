import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Query, WorkPackageFilter, SortBy } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateQueryInput {
  projectId?: string | null
  name: string
  filters: WorkPackageFilter
  sortBy: SortBy[]
  groupBy?: string | null
  displayMode?: 'table' | 'gantt' | 'board' | 'calendar'
  isDefault?: boolean
}

export interface UpdateQueryInput {
  name?: string
  filters?: WorkPackageFilter
  sortBy?: SortBy[]
  groupBy?: string | null
  displayMode?: 'table' | 'gantt' | 'board' | 'calendar'
  isDefault?: boolean
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List saved queries, optionally scoped to a project */
export function useSavedQueries(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.queries(projectId),
    queryFn: async (): Promise<Query[]> => {
      const url = projectId ? `/api/queries?projectId=${projectId}` : '/api/queries'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch queries')
      return res.json()
    },
  })
}

/** Fetch a single saved query by id */
export function useQueryById(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.query(id ?? ''),
    queryFn: async (): Promise<Query> => {
      const res = await fetch(`/api/queries/${id}`)
      if (!res.ok) throw new Error('Failed to fetch query')
      return res.json()
    },
    enabled: !!id,
  })
}

/** Create a new saved query */
export function useCreateQuery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateQueryInput) => {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create query')
      return res.json()
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queries(vars.projectId ?? undefined) })
    },
  })
}

/** Update a saved query */
export function useUpdateQuery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateQueryInput }) => {
      const res = await fetch(`/api/queries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update query')
      return res.json()
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.query(updated.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.queries() })
    },
  })
}

/** Delete a saved query */
export function useDeleteQuery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/queries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete query')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.queries() })
    },
  })
}
