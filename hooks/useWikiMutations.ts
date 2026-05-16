import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WikiPage } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface CreateWikiPageInput {
  projectId: string
  title: string
  content?: string
  parentId?: string
  authorId: string
}

interface UpdateWikiPageInput {
  title?: string
  content?: string
  parentId?: string | null
}

interface RestoreWikiVersionInput {
  projectId: string
  slug: string
  version: number
}

async function createWikiPage(data: CreateWikiPageInput): Promise<WikiPage> {
  const res = await fetch('/api/wiki', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create wiki page')
  return res.json()
}

async function updateWikiPage(
  id: string,
  data: UpdateWikiPageInput
): Promise<WikiPage> {
  const res = await fetch(`/api/wiki/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update wiki page')
  return res.json()
}

async function deleteWikiPage(id: string): Promise<void> {
  const res = await fetch(`/api/wiki/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete wiki page')
}

async function restoreWikiVersion(data: RestoreWikiVersionInput): Promise<{ page: WikiPage }> {
  const res = await fetch(`/api/projects/${data.projectId}/wiki/${data.slug}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: data.version }),
  })
  if (!res.ok) throw new Error('Failed to restore wiki version')
  return res.json()
}

export function useCreateWikiPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWikiPage,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wikiPages(variables.projectId) })
    },
  })
}

export function useUpdateWikiPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWikiPageInput }) =>
      updateWikiPage(id, data),

    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wikiPage(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['wiki-pages'] })
    },
  })
}

export function useDeleteWikiPage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWikiPage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wiki-pages'] })
    },
  })
}

export function useRestoreWikiVersion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RestoreWikiVersionInput) => restoreWikiVersion(data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wikiVersions(variables.projectId, variables.slug) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.wikiPage(variables.slug) })
    },
  })
}
