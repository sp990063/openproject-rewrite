// hooks/useWikiMutations.ts
//
// Wiki mutations: create, update, delete, restore version.
// All endpoints follow the project-scoped Phase 3+ pattern
// (`/api/projects/[projectId]/wiki/...`). Return shapes are unwrapped
// from the standard `{ success, data }` envelope.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WikiPage } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface CreateWikiPageInput {
  projectId: string
  title: string
  content?: string
  parentId?: string
}

interface UpdateWikiPageInput {
  projectId: string
  slug: string
  title?: string
  content?: string
  parentId?: string | null
}

interface DeleteWikiPageInput {
  projectId: string
  slug: string
}

interface RestoreWikiVersionInput {
  projectId: string
  slug: string
  version: number
}

async function createWikiPage(data: CreateWikiPageInput): Promise<WikiPage> {
  const res = await fetch(`/api/projects/${data.projectId}/wiki`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: data.title,
      content: data.content ?? '',
      parentId: data.parentId,
    }),
  })
  if (!res.ok) throw new Error('Failed to create wiki page')
  const json = await res.json()
  return json.data
}

async function updateWikiPage(data: UpdateWikiPageInput): Promise<WikiPage> {
  const { projectId, slug, ...patch } = data
  const res = await fetch(`/api/projects/${projectId}/wiki/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error('Failed to update wiki page')
  const json = await res.json()
  return json.data
}

async function deleteWikiPage(data: DeleteWikiPageInput): Promise<void> {
  const res = await fetch(`/api/projects/${data.projectId}/wiki/${data.slug}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete wiki page')
}

async function restoreWikiVersion(data: RestoreWikiVersionInput): Promise<WikiPage> {
  const res = await fetch(
    `/api/projects/${data.projectId}/wiki/${data.slug}/restore/${data.version}`,
    { method: 'POST' },
  )
  if (!res.ok) throw new Error('Failed to restore wiki version')
  const json = await res.json()
  return json.data
}

export function useCreateWikiPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWikiPage,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wikiPages(variables.projectId),
      })
    },
  })
}

export function useUpdateWikiPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateWikiPage,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wikiPage(variables.slug),
      })
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
    mutationFn: restoreWikiVersion,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wikiVersions(variables.projectId, variables.slug),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.wikiPage(variables.slug),
      })
    },
  })
}
