import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Query, WorkPackageFilter, SortBy } from '@/types'

// ─── Query Keys ─────────────────────────────────────────────────────────────────

export const queryKeys = {
  allSavedQueries: (projectId?: string) =>
    ['savedQueries', projectId ?? 'all'] as const,
  savedQuery: (id: string) => ['savedQueries', id] as const,
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchSavedQueries(projectId?: string): Promise<Query[]> {
  const url = projectId ? `/api/queries?projectId=${projectId}` : '/api/queries'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch saved queries')
  return res.json()
}

async function createSavedQuery(data: {
  name: string
  projectId?: string
  filters: WorkPackageFilter
  sortBy: SortBy[]
  groupBy?: string | null
  displayMode: string
  isDefault?: boolean
}): Promise<Query> {
  const res = await fetch('/api/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create saved query')
  return res.json()
}

async function updateSavedQuery(
  id: string,
  data: Partial<{
    name: string
    filters: WorkPackageFilter
    sortBy: SortBy[]
    groupBy: string | null
    displayMode: string
    isDefault: boolean
  }>
): Promise<Query> {
  const res = await fetch(`/api/queries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update saved query')
  return res.json()
}

async function deleteSavedQuery(id: string): Promise<void> {
  const res = await fetch(`/api/queries/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete saved query')
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useSavedQueries(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.allSavedQueries(projectId),
    queryFn: () => fetchSavedQueries(projectId),
  })
}

export function useSavedQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.savedQuery(id),
    queryFn: () => fetch(`/api/queries/${id}`).then((r) => r.json()),
    enabled: !!id,
  })
}

export function useCreateSavedQuery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSavedQuery,
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSavedQueries(variables.projectId) })
    },
  })
}

export function useUpdateSavedQuery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSavedQuery>[1] }) =>
      updateSavedQuery(id, data),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSavedQueries() })
      void queryClient.setQueryData(queryKeys.savedQuery(updated.id), updated)
    },
  })
}

export function useDeleteSavedQuery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSavedQuery,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSavedQueries() })
    },
  })
}
