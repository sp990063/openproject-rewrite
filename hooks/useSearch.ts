import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SearchParams, SearchResponse } from '@/types'

const RECENT_SEARCHES_KEY = 'recent_searches'
const MAX_RECENT_SEARCHES = 10

async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('q', params.q)
  if (params.projectId) searchParams.set('projectId', params.projectId)
  if (params.types?.length) searchParams.set('types', params.types.join(','))
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const url = `/api/search?${searchParams}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

/**
 * Get recent searches from localStorage
 */
export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Add a search to recent searches in localStorage
 */
export function addRecentSearch(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return
  try {
    const recent = getRecentSearches().filter(s => s !== query)
    const updated = [query, ...recent].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  } catch {
    // Ignore localStorage errors
  }
}

export function useSearch(params: SearchParams, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState(params.q || '')

  // Debounce the query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(params.q)
    }, 300)
    return () => clearTimeout(timer)
  }, [params.q])

  const queryParams = { ...params, q: debouncedQuery }

  return useQuery({
    queryKey: ['search', queryParams.q, queryParams.projectId, queryParams.types, queryParams.limit, queryParams.offset],
    queryFn: () => fetchSearch(queryParams),
    enabled: enabled && debouncedQuery.trim().length > 0,
    staleTime: 1000 * 60, // 1 minute
  })
}
