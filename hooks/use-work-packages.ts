import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  WorkPackage,
  WorkPackageFilter,
} from '@/types'
import { queryKeys } from '@/queries/queryKeys'

// ─── Shared input types ───────────────────────────────────────────────────────

export interface CreateWorkPackageInput {
  projectId: string
  subject: string
  description?: string
  statusId: string
  typeId?: string     // optional — API defaults to project default type
  priorityId?: string // optional — API defaults to default priority
  assigneeId?: string
  authorId?: string   // optional — API defaults to current user
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

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchWorkPackages(filters?: WorkPackageFilter): Promise<WorkPackage[]> {
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
}

async function fetchWorkPackage(id: string): Promise<WorkPackage> {
  const res = await fetch(`/api/work-packages/${id}`)
  if (!res.ok) throw new Error('Failed to fetch work package')
  return res.json()
}

async function createWorkPackage(data: CreateWorkPackageInput): Promise<WorkPackage> {
  const res = await fetch('/api/work-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create work package')
  return res.json()
}

async function updateWorkPackage(
  id: string,
  data: UpdateWorkPackageInput
): Promise<WorkPackage> {
  const res = await fetch(`/api/work-packages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update work package')
  return res.json()
}

async function deleteWorkPackage(id: string): Promise<void> {
  const res = await fetch(`/api/work-packages/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete work package')
}

async function fetchRelations(workPackageId: string) {
  const res = await fetch(`/api/work-packages/${workPackageId}/relations`)
  if (!res.ok) throw new Error('Failed to fetch relations')
  return res.json()
}

async function createRelation(data: {
  fromId: string
  toId: string
  relationType: 'blocks' | 'blocked_by' | 'precedes' | 'follows' | 'relates'
}) {
  const res = await fetch(`/api/work-packages/${data.fromId}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create relation')
  return res.json()
}

async function deleteRelation(id: string): Promise<void> {
  const res = await fetch(`/api/relations/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete relation')
}

async function reorderWorkPackage({
  workPackageId,
  position,
}: {
  workPackageId: string
  position: number
}) {
  const res = await fetch('/api/work-packages/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workPackageId, position }),
  })
  if (!res.ok) throw new Error('Failed to reorder work package')
  return res.json()
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

/**
 * List work packages with optional filters.
 * Filters: projectId, statusId[], typeId[], assigneeId[], priorityId[],
 * startDate/lte/gte, dueDate/lte/gte, search
 */
export function useWorkPackages(filters?: WorkPackageFilter) {
  const workPackages = useQuery({
    queryKey: queryKeys.workPackages(filters),
    queryFn: () => fetchWorkPackages(filters),
    // Enable when projectId is present, or when no filter needed
    enabled: !filters?.projectId || !!filters.projectId,
  })

  return { workPackages }
}

/** Fetch a single work package by id */
export function useWorkPackage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workPackage(id ?? ''),
    queryFn: () => fetchWorkPackage(id!),
    enabled: !!id,
  })
}

// ─── Mutation hooks ────────────────────────────────────────────────────────────

/** Create a new work package */
export function useCreateWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorkPackage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/** Delete a work package */
export function useDeleteWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWorkPackage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/**
 * Update a work package with optimistic updates.
 * Rolls back automatically on error.
 */
export function useUpdateWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkPackageInput }) =>
      updateWorkPackage(id, data),

    // Optimistic update: apply change immediately, revert on error
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.workPackage(id) })

      // Snapshot previous value for rollback
      const previousWp = queryClient.getQueryData<WorkPackage>(queryKeys.workPackage(id))

      // Optimistically apply the update
      queryClient.setQueryData<WorkPackage>(queryKeys.workPackage(id), (old) =>
        old ? ({ ...old, ...data } as WorkPackage) : old
      )

      return { previousWp }
    },

    onError: (_err, { id }, context) => {
      // Rollback to snapshot on error
      if (context?.previousWp) {
        queryClient.setQueryData(queryKeys.workPackage(id), context.previousWp)
      }
      // Invalidate list queries to resync
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },

    onSettled: (_data, _err, { id }) => {
      // Always refetch after settle to ensure server consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.workPackage(id) })
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

/** Reorder a work package within its group (board drag-and-drop) */
export function useReorderWorkPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: reorderWorkPackage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

// ─── Relations ─────────────────────────────────────────────────────────────────

/** Fetch relations for a work package */
export function useWorkPackageRelations(workPackageId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workPackageRelations(workPackageId ?? ''),
    queryFn: () => fetchRelations(workPackageId!),
    enabled: !!workPackageId,
  })
}

/** Create a new relation between two work packages */
export function useCreateRelation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRelation,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workPackageRelations(vars.fromId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.workPackageRelations(vars.toId),
      })
    },
  })
}

/** Delete a relation */
export function useDeleteRelation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteRelation,
    onSuccess: (_data, _vars, _ctx) => {
      // Invalidate all relation caches (we don't know which WP pair was affected)
      void queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })
}

// ─── Activities ─────────────────────────────────────────────────────────────────

/** Fetch activities/comments for a work package */
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
