import { useQuery } from '@tanstack/react-query'
import type { WikiPage, WikiPageVersion } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface WikiPageResponse extends Omit<WikiPage, 'createdAt' | 'updatedAt' | 'parent' | 'children' | 'author' | 'project' | 'versions'> {
  createdAt: string
  updatedAt: string
  author: { id: string; name: string; email?: string; avatarUrl?: string | null }
  parent: { id: string; title: string; slug: string } | null
  children: { id: string; title: string; slug: string }[]
  project: { id: string; name: string; identifier: string }
}

interface WikiVersionsResponse {
  wikiPageId: string
  wikiPageTitle: string
  versions: (WikiPageVersion & {
    author: { id: string; name: string; avatarUrl?: string | null }
  })[]
}

async function fetchWikiPage(projectId: string, slug: string): Promise<WikiPageResponse> {
  const res = await fetch(`/api/projects/${projectId}/wiki/${slug}`)
  if (!res.ok) throw new Error('Failed to fetch wiki page')
  return res.json()
}

async function fetchWikiVersions(projectId: string, slug: string): Promise<WikiVersionsResponse> {
  const res = await fetch(`/api/projects/${projectId}/wiki/${slug}/versions`)
  if (!res.ok) throw new Error('Failed to fetch wiki versions')
  return res.json()
}

export function useWikiPage(projectId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiPage(slug ?? ''),
    queryFn: () => fetchWikiPage(projectId!, slug!),
    enabled: !!projectId && !!slug,
  })
}

export function useWikiVersions(projectId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiVersions(projectId ?? '', slug ?? ''),
    queryFn: () => fetchWikiVersions(projectId!, slug!),
    enabled: !!projectId && !!slug,
  })
}
