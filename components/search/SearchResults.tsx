import React from 'react'
import type { SearchResponse, SearchResultType } from '@/types'
import { SearchResultItem } from './SearchResultItem'

interface SearchResultsProps {
  results: SearchResponse | undefined
  isLoading: boolean
  isError: boolean
  query: string
}

const typeFilters: { type: SearchResultType; label: string }[] = [
  { type: 'wiki', label: 'Wiki Pages' },
  { type: 'forum', label: 'Forums' },
  { type: 'document', label: 'Documents' },
  { type: 'meeting', label: 'Meetings' },
  { type: 'work_package', label: 'Work Packages' },
]

function SpinnerIcon() {
  return (
    <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function NoResultsIcon() {
  return (
    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

export function SearchResults({ results, isLoading, isError, query }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerIcon />
        <span className="ml-3 text-gray-500">Searching...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <NoResultsIcon />
        <p className="text-lg font-medium text-gray-700 mt-3">Search failed</p>
        <p className="text-sm">Please try again later</p>
      </div>
    )
  }

  if (!query.trim()) {
    return (
      <div className="py-12 text-center text-gray-500">
        <NoResultsIcon />
        <p className="text-lg font-medium text-gray-700 mt-3">Enter a search term</p>
        <p className="text-sm">Search across wiki pages, forums, documents, and more</p>
      </div>
    )
  }

  if (results && results.results.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <NoResultsIcon />
        <p className="text-lg font-medium text-gray-700 mt-3">No results found</p>
        <p className="text-sm">Try different keywords or check your spelling</p>
      </div>
    )
  }

  if (!results) return null

  const groupedResults = results.results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = []
      }
      acc[result.type].push(result)
      return acc
    },
    {} as Record<SearchResultType, typeof results.results>
  )

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-500">
        Found {results.total} result{results.total !== 1 ? 's' : ''} for &quot;{query}&quot;
      </div>

      <div className="space-y-8">
        {typeFilters.map(({ type, label }) => {
          const typeResults = groupedResults[type]
          if (!typeResults?.length) return null

          return (
            <div key={type}>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                {label} ({typeResults.length})
              </h3>
              <div className="space-y-3">
                {typeResults.map((result) => (
                  <SearchResultItem key={result.id} result={result} query={query} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
