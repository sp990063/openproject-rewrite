import { useQuery } from '@tanstack/react-query'
import type { WikiPage } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface WikiPagesResponse extends WikiPage {
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  parent: { id: string; title: string; slug: string } | null
  _count: { children: number; versions: number }
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