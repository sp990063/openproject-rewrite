import { useQuery } from '@tanstack/react-query'
import type { WikiPageVersion } from '@/types'
import { queryKeys } from '@/queries/queryKeys'

interface WikiVersionWithAuthor extends Omit<WikiPageVersion, 'createdAt'> {
  createdAt: string
  author: { id: string; name: string }
}

interface WikiVersionsResponse {
  versions: WikiVersionWithAuthor[]
}

async function fetchWikiVersions(projectId: string, slug: string): Promise<WikiVersionWithAuthor[]> {
  const res = await fetch(`/api/projects/${projectId}/wiki/${slug}/versions`)
  if (!res.ok) throw new Error('Failed to fetch wiki versions')
  const data: WikiVersionsResponse = await res.json()
  return data.versions
}

export function useWikiVersions(projectId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiVersions(projectId ?? '', slug ?? ''),
    queryFn: () => fetchWikiVersions(projectId!, slug!),
    enabled: !!projectId && !!slug,
  })
}

interface WikiVersionResponse {
  version: WikiVersionWithAuthor
}

async function fetchWikiVersion(projectId: string, slug: string, version: number): Promise<WikiVersionWithAuthor> {
  const res = await fetch(`/api/projects/${projectId}/wiki/${slug}/versions/${version}`)
  if (!res.ok) throw new Error('Failed to fetch wiki version')
  const json = await res.json()
  return json.data
}

export function useWikiVersion(projectId: string | undefined, slug: string | undefined, version: number | undefined) {
  return useQuery({
    queryKey: queryKeys.wikiVersion(projectId ?? '', slug ?? '', version ?? 0),
    queryFn: () => fetchWikiVersion(projectId!, slug!, version!),
    enabled: !!projectId && !!slug && version !== undefined,
  })
}
