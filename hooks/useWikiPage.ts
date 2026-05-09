import { useQuery } from '@tanstack/react-query'
import type { WikiPage } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface WikiPageResponse extends WikiPage {
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  parent: { id: string; title: string; slug: string } | null
  children: { id: string; title: string; slug: string }[]
  project: { id: string; name: string; identifier: string }
}

async function fetchWikiPage(idOrSlug: string, bySlug = false): Promise<WikiPageResponse> {
  const url = bySlug ? `/api/wiki/by-slug/${idOrSlug}` : `/api/wiki/${idOrSlug}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch wiki page')
  return res.json()
}

export function useWikiPage(projectId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiPage(slug ?? ''),
    queryFn: () => fetchWikiPage(slug!, true),
    enabled: !!projectId && !!slug,
  })
}