import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WorkPackage } from '@/types'

interface CreateWorkPackageInput {
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

interface UpdateWorkPackageInput {
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

export function useWorkPackages(projectId?: string) {
  const queryClient = useQueryClient()

  const workPackages = useQuery({
    queryKey: ['work-packages', projectId],
    queryFn: async () => {
      const url = projectId ? `/api/work-packages?projectId=${projectId}` : '/api/work-packages'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch work packages')
      return res.json() as Promise<WorkPackage[]>
    },
    enabled: !projectId || !!projectId,
  })

  const createWorkPackage = useMutation({
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

  const updateWorkPackage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateWorkPackageInput }) => {
      const res = await fetch(`/api/work-packages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update work package')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })

  const deleteWorkPackage = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/work-packages/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete work package')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-packages'] })
    },
  })

  return {
    workPackages,
    createWorkPackage,
    updateWorkPackage,
    deleteWorkPackage,
  }
}
