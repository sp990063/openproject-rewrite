/**
 * Global Search Types
 */

export type SearchResultType = 'wiki' | 'forum' | 'document' | 'meeting' | 'work_package'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  summary: string | null
  projectId: string
  projectName: string
  url: string
  updatedAt: string | Date
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
  limit: number
  offset: number
}

export interface SearchFilters {
  types?: SearchResultType[]
  projectId?: string
}

export interface SearchParams {
  q: string
  projectId?: string
  types?: SearchResultType[]
  limit?: number
  offset?: number
}
