import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/queries/queryKeys'

export interface CreateNewsInput {
  projectId: string
  title: string
  summary?: string
  content: string
}

async function createNews(data: CreateNewsInput) {
  const res = await fetch(`/api/projects/${data.projectId}/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: data.title, summary: data.summary, content: data.content }),
  })
  if (!res.ok) throw new Error('Failed to create news')
  return res.json()
}

async function deleteNews(projectId: string, slug: string) {
  const res = await fetch(`/api/projects/${projectId}/news/${slug}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete news')
  return res.json()
}

export interface CreateCommentInput {
  projectId: string
  slug: string
  content: string
}

async function createComment(data: CreateCommentInput) {
  const res = await fetch(`/api/projects/${data.projectId}/news/${data.slug}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: data.content }),
  })
  if (!res.ok) throw new Error('Failed to create comment')
  return res.json()
}

export function useCreateNews() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createNews,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.newsList(variables.projectId, 1) })
    },
  })
}

export function useDeleteNews() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, slug }: { projectId: string; slug: string }) =>
      deleteNews(projectId, slug),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.newsList(variables.projectId, 1) })
    },
  })
}

export function useCreateNewsComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createComment,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.newsItem(variables.projectId, variables.slug) })
    },
  })
}
