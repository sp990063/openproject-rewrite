export const dynamic = 'force-dynamic'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { SearchBar, SearchResults } from '@/components/search'
import { useSearch } from '@/hooks/useSearch'
import { getRecentSearches, clearRecentSearches } from '@/hooks/useSearch'
import type { SearchResultType } from '@/types'

const typeOptions: { value: SearchResultType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wiki', label: 'Wiki Pages' },
  { value: 'forum', label: 'Forums' },
  { value: 'document', label: 'Documents' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'work_package', label: 'Work Packages' },
]

/**
 * /search — global cross-project search
 *
 * Sprint 5 (Global Search) — fills the gap where the topbar GlobalSearch
 * stub links to /search but no global search page existed. The pre-existing
 * /api/search endpoint and useSearch hook already work cross-project.
 *
 * Mirrors `pages/projects/[projectId]/search.tsx` minus the projectId filter.
 */
export default function GlobalSearchPage() {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showAll, setShowAll] = useState(true)
  const [recent, setRecent] = useState<string[]>([])

  // Hydrate recent searches from localStorage on mount
  React.useEffect(() => {
    setRecent(getRecentSearches())
  }, [])

  const { data: searchResults, isLoading, isError } = useSearch(
    {
      q: debouncedQuery,
      // no projectId — global search
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
      limit: 20,
    },
    debouncedQuery.trim().length > 0
  )

  const handleSearch = useCallback((value: string) => {
    setDebouncedQuery(value)
  }, [])

  const handleTypeToggle = useCallback((type: SearchResultType | 'all') => {
    if (type === 'all') {
      setShowAll(true)
      setSelectedTypes([])
    } else {
      setShowAll(false)
      setSelectedTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
      )
    }
  }, [])

  const handleClearFilters = useCallback(() => {
    setShowAll(true)
    setSelectedTypes([])
  }, [])

  const handleRecentClick = useCallback((q: string) => {
    setQuery(q)
    setDebouncedQuery(q)
  }, [])

  const handleClearRecent = useCallback(() => {
    clearRecentSearches()
    setRecent([])
  }, [])

  const handleNavigateToProject = useCallback(
    (projectId: string) => {
      router.push(`/projects/${projectId}/search?q=${encodeURIComponent(debouncedQuery)}`)
    },
    [router, debouncedQuery]
  )

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search across all projects: wiki pages, forums, documents, meetings, and work packages
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            placeholder="Search across all projects..."
            autoFocus
            className="mb-4"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Filter by:</span>
            {typeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleTypeToggle(value)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  (value === 'all' && showAll) ||
                  (value !== 'all' && selectedTypes.includes(value as SearchResultType))
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            {selectedTypes.length > 0 && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Recent searches (only show when no active query) */}
        {!debouncedQuery && recent.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">Recent searches</h2>
              <button
                onClick={handleClearRecent}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((q) => (
                <button
                  key={q}
                  onClick={() => handleRecentClick(q)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {debouncedQuery && searchResults && (
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for "
                {debouncedQuery}"
              </p>
              {/* Project breakdown for global results */}
              {searchResults.results.length > 0 && (
                <ProjectBreakdown
                  results={searchResults.results}
                  onProjectClick={handleNavigateToProject}
                />
              )}
            </div>
          )}
          <SearchResults
            results={searchResults}
            isLoading={isLoading}
            isError={isError}
            query={debouncedQuery}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  )
}

/**
 * Compact "results by project" pills under the result count.
 * Lets the user jump to the per-project search page scoped to this query.
 */
function ProjectBreakdown({
  results,
  onProjectClick,
}: {
  results: ReadonlyArray<{ projectId: string; projectName: string; type: string }>
  onProjectClick: (projectId: string) => void
}) {
  const byProject = new Map<string, { name: string; count: number }>()
  for (const r of results) {
    const entry = byProject.get(r.projectId)
    if (entry) {
      entry.count++
    } else {
      byProject.set(r.projectId, { name: r.projectName, count: 1 })
    }
  }
  if (byProject.size <= 1) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">In projects:</span>
      {[...byProject.entries()].map(([projectId, { name, count }]) => (
        <button
          key={projectId}
          onClick={() => onProjectClick(projectId)}
          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
          title={`Search in ${name}`}
        >
          {name} ({count})
        </button>
      ))}
    </div>
  )
}
