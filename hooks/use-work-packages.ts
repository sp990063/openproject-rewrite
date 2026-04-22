import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  WorkPackage,
  WorkPackageFilter,
  UpdateWorkPackageInput,
  CreateWorkPackageInput,
} from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Shared input types (used across hooks) ─────────────────────────────────

export interface CreateWorkPackageInput {
  projectId: string
  subject: string
  description?: string
  statusId: string
  typeId: string
  priorityId: string
  assigneeId?: string
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  parentId?: string
}

export interface UpdateWorkPackageInput {
  subject?: string
  description?: string
  statusId?: string
  typeId?: string
  priorityId?: string
  assigneeId?: string
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  parentId?: string
  position?: number
}

// ─── Phase 1 hooks (extended) ───────────────────────────────────────────────

/**
 * List work packages with optional filters.
 * Phase 1: projectId filter only.
 * Phase 2: full WorkPackageFilter support.
 */
export function useWorkPackages(filters?: WorkPackageFilter) {
  const workPackages = useQuery({
    queryKey: queryKeys.workPackages(filters),
    queryFn: async (): Promise<WorkPackage[]> => {
      const params = new URLSearchParams()
      if (filters?.projectId) params.set('projectId', filters.projectId)
      if (filters?.statusId?.length) params.set('statusId', filters.statusId.join(','))
      if (filters?.typeId?.length) params.set('typeId', filters.typeId.join(','))
      if (filters?.assigneeId?.length) params.set('assigneeId', filters.assigneeId.join(','))
      if (filters?.priorityId?.length) params.set('priorityId', filters.priorityId.join(','))
      if (filters?.startDate?.gte) params.set('startDateGte', filters.startDate.gte)
      if (filters?.startDate?.lte) params.set('startDateLte', filters.startDate.lte)
      if (filters?.dueDate?.gte) params.set('dueDateGte', filters.dueDate.gte)
      if (filters?.dueDate?.lte) params.set('dueDateLte', filters.dueDate.lte)
      if (filters?.search) params.set('search', filters.search)

      const url = `/api/work-packages${params.size ? `?${params}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch work packages')
      return res.json()
    },
    enabled: !filters?.projectId || !!filters.projectId,
  })

  return { workPackages }
}

/** Phase 1: create a new work package */
export function useCreateWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateWorkPackageInput) => {
      const res = await fetch('/api/work-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create work package')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/** Phase 1: delete a work package */
export function useDeleteWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/work-packages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete work package')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

// ─── Phase 2 hooks ───────────────────────────────────────────────────────────

/** Fetch a single work package by id */
export function useWorkPackage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workPackage(id ?? ''),
    queryFn: async (): Promise<WorkPackage> => {
      const res = await fetch(`/api/work-packages/${id}`)
      if (!res.ok) throw new Error('Failed to fetch work package')
      return res.json()
    },
    enabled: !!id,
  })
}

/**
 * Update a work package with optimistic updates.
 * Rolls back automatically on error.
 */
export function useUpdateWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWorkPackageInput }) => {
      const res = await fetch(`/api/work-packages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update work package')
      return res.json()
    },
    // Optimistic update: apply change immediately, revert on error
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workPackage(id) })

      // Snapshot previous value for rollback
      const previousWp = queryClient.getQueryData<WorkPackage>(queryKeys.workPackage(id))

      // Optimistically apply the update (only spread changed fields)
      queryClient.setQueryData<WorkPackage>(queryKeys.workPackage(id), (old) =>
        old ? { ...old, ...data } : old
      )

      return { previousWp }
    },
    onError: (_err, { id }, context) => {
      // Rollback to snapshot on error
      if (context?.previousWp) {
        queryClient.setQueryData(queryKeys.workPackage(id), context.previousWp)
      }
      // Invalidate list queries to resync
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
    onSettled: (_data, _err, { id }) => {
      // Always refetch after settle to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workPackage(id) })
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/** Fetch activities for a work package */
export function useWorkPackageActivities(workPackageId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workPackageActivities(workPackageId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/work-packages/${workPackageId}/activities`)
      if (!res.ok) throw new Error('Failed to fetch activities')
      return res.json()
    },
    enabled: !!workPackageId,
  })
}

/** Fetch relations for a work package */
export function useWorkPackageRelations(workPackageId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workPackageRelations(workPackageId ?? ''),
    queryFn: async () => {
      const res = await fetch(`/api/work-packages/${workPackageId}/relations`)
      if (!res.ok) throw new Error('Failed to fetch relations')
      return res.json()
    },
    enabled: !!workPackageId,
  })
}

/** Create a new relation between two work packages */
export function useCreateRelation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      fromId: string
      toId: string
      relationType: 'blocks' | 'blocked_by' | 'precedes' | 'follows' | 'relates'
    }) => {
      const res = await fetch(`/api/work-packages/${data.fromId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create relation')
      return res.json()
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workPackageRelations(vars.fromId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.workPackageRelations(vars.toId) })
    },
  })
}

/** Delete a relation */
export function useDeleteRelation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete relation')
    },
    onSuccess: () => {
      // Invalidate all relation caches (we don't know which WP pair was affected)
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/** Reorder a work package within its group (board drag-and-drop) */
export function useReorderWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workPackageId, position }: { workPackageId: string; position: number }) => {
      const res = await fetch('/api/work-packages/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workPackageId, position }),
      })
      if (!res.ok) throw new Error('Failed to reorder work package')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}
