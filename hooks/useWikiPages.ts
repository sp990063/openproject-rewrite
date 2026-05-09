import { useQuery } from '@tanstack/react-query'
import type { WikiPage } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface WikiPagesResponse extends Omit<WikiPage, 'children' | 'parent' | 'author' | 'project' | 'versions'> {
  children: { id: string; title: string; slug: string }[]
  parent: { id: string; title: string; slug: string } | null
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  project: { id: string; name: string; identifier: string }
  versions?: { id: string; version: number; createdAt: string }[]
}

async function fetchWikiPages(projectId: string): Promise<WikiPagesResponse[]> {
  const res = await fetch(`/api/wiki?projectId=${projectId}`)
  if (!res.ok) throw new Error('Failed to fetch wiki pages')
  return res.json()
}

export function useWikiPages(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiPages(projectId ?? ''),
    queryFn: () => fetchWikiPages(projectId!),
    enabled: !!projectId,
  })
}