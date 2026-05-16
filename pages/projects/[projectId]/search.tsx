export const dynamic = 'force-dynamic'

import React, { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout'
import { SearchBar, SearchResults } from '@/components/search'
import { useSearch } from '@/hooks/useSearch'
import type { SearchResultType } from '@/types'
import { useProjects } from '@/hooks/use-projects'
import Link from 'next/link'

const typeOptions: { value: SearchResultType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wiki', label: 'Wiki Pages' },
  { value: 'forum', label: 'Forums' },
  { value: 'document', label: 'Documents' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'work_package', label: 'Work Packages' },
]

export default function ProjectSearchPage() {
  const router = useRouter()
  const { projectId } = router.query
  const { projects } = useProjects()

  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showAll, setShowAll] = useState(true)

  const project = projects.data?.find((p) => p.id === projectId)

  const { data: searchResults, isLoading, isError } = useSearch(
    {
      q: debouncedQuery,
      projectId: projectId as string | undefined,
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

  if (!projectId) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </AuthenticatedLayout>
    )
  }

  if (projects.isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12 text-gray-500">Loading project...</div>
      </AuthenticatedLayout>
    )
  }

  if (!project) {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Project not found</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-500">
            Back to projects
          </Link>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to {project.name}
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Search {project.name}</h1>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            placeholder={`Search in ${project.name}...`}
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
                  (value === 'all' && showAll) || (value !== 'all' && selectedTypes.includes(value as SearchResultType))
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {debouncedQuery && searchResults && (
            <p className="text-sm text-gray-500 mb-4">
              Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''} for "{debouncedQuery}"
            </p>
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
