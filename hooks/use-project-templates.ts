import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ProjectTemplate } from '@/types'

interface CreateTemplateInput {
  name: string
  description?: string
  modules: string[]
}

interface UpdateTemplateInput {
  name?: string
  description?: string
  modules?: string[]
}

export function useProjectTemplates() {
  const queryClient = useQueryClient()

  const templates = useQuery({
    queryKey: ['project-templates'],
    queryFn: async () => {
      const res = await fetch('/api/project-templates')
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json() as Promise<ProjectTemplate[]>
    },
  })

  const createTemplate = useMutation({
    mutationFn: async (data: CreateTemplateInput) => {
      const res = await fetch('/api/project-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create template')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] })
    },
  })

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTemplateInput }) => {
      const res = await fetch(`/api/project-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update template')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] })
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete template')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-templates'] })
    },
  })

  return {
    templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  }
}
