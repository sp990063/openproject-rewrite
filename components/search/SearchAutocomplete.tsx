'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSearch } from '@/hooks/useSearch'
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '@/hooks/useSearch'
import type { SearchParams } from '@/types'
import Link from 'next/link'

interface SearchAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  className?: string
  projectId?: string
}

export function SearchAutocomplete({
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  className = '',
  projectId,
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  // Search query with debounce handled in useSearch hook
  const searchParams: SearchParams = { q: value, projectId, limit: 5 }
  const { data: searchResults } = useSearch(searchParams, value.trim().length > 0)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    addRecentSearch(selectedValue)
    setRecentSearches(getRecentSearches())
    onSearch?.(selectedValue)
    setIsOpen(false)
  }

  const handleClearRecent = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  const showDropdown = isOpen && (
    (value.trim().length === 0 && recentSearches.length > 0) ||
    (value.trim().length > 0 && searchResults?.results)
  )

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSearch?.(value)
            addRecentSearch(value)
            setRecentSearches(getRecentSearches())
            setIsOpen(false)
          }
        }}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />

      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
          {/* Recent searches section */}
          {value.trim().length === 0 && recentSearches.length > 0 && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs text-gray-500 uppercase">Recent Searches</span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-blue-600 hover:text-blue-500"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(search)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded"
                >
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Search suggestions */}
          {value.trim().length > 0 && searchResults?.results && (
            <div className="p-2">
              <span className="text-xs text-gray-500 uppercase px-2 py-1">Suggestions</span>
              {searchResults.results.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">No results found</div>
              ) : (
                searchResults.results.map((result, index) => (
                  <Link
                    key={index}
                    href={getResultUrl(result)}
                    onClick={() => {
                      addRecentSearch(value)
                      setRecentSearches(getRecentSearches())
                      setIsOpen(false)
                    }}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 rounded"
                  >
                    <span className="text-gray-700 truncate">{result.title}</span>
                    <span className="text-xs text-gray-400 capitalize ml-2">{result.type.replace('_', ' ')}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getResultUrl(result: { type: string; id: string }): string {
  const typeToPath: Record<string, string> = {
    wiki: '/wiki',
    forum: '/forums',
    document: '/documents',
    meeting: '/meetings',
    work_package: '/work-packages',
  }
  const basePath = typeToPath[result.type] || ''
  return `${basePath}/${result.id}`
}
