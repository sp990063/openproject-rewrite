// lib/hooks/useBacklogs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Sprint {
  id: string; projectId: string; name: string
  startDate: string; endDate: string; capacity?: number
  velocity?: number; status: 'OPEN' | 'ACTIVE' | 'CLOSED'
  storyPoints?: number; assignee?: { id: string; name: string } | null
  sprintMembers: { id: string; userId: string; capacity: number }[]
}

export interface BurndownPoint {
  date: string; remaining: number; ideal: number
}

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/sprints`).then(r => r.json()),
  })
}

export function useSprint(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => fetch(`/api/projects/sprints/${sprintId}`).then(r => r.json()),
    enabled: !!sprintId,
  })
}

export function useCreateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      fetch(`/api/projects/${projectId}/sprints`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  })
}

export function useUpdateSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sprintId, projectId, data }: { sprintId: string; projectId: string; data: any }) =>
      fetch(`/api/projects/${projectId}/sprints/${sprintId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: (_, { sprintId, projectId }) => {
      qc.invalidateQueries({ queryKey: ['sprint', sprintId] })
      qc.invalidateQueries({ queryKey: ['sprints', projectId] })
    },
  })
}

export function useSprintBoard(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprint-board', sprintId],
    queryFn: () => fetch(`/api/projects/sprints/${sprintId}/board`).then(r => r.json()),
    enabled: !!sprintId,
  })
}

export function useMoveWorkPackage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sprintId, ...payload }: { sprintId: string; workPackageId: string; statusId: string; position: number }) =>
      fetch(`/api/projects/sprints/${sprintId}/board`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: (_, { sprintId }) => qc.invalidateQueries({ queryKey: ['sprint-board', sprintId] }),
  })
}

export function useBurndown(sprintId: string | null) {
  return useQuery({
    queryKey: ['burndown', sprintId],
    queryFn: () => fetch(`/api/projects/sprints/${sprintId}/burndown`).then(r => r.json()),
    enabled: !!sprintId,
  })
}

export function useRecordBurndown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sprintId, ...payload }: { sprintId: string; date: string; remaining: number }) =>
      fetch(`/api/projects/sprints/${sprintId}/burndown`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json()),
    onSuccess: (_, { sprintId }) => qc.invalidateQueries({ queryKey: ['burndown', sprintId] }),
  })
}
