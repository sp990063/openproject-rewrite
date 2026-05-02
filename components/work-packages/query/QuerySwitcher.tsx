import React, { useState } from 'react'
import { useSavedQueries, useDeleteSavedQuery, useUpdateSavedQuery } from '@/hooks/use-queries'
import { Button, Modal } from '@/components/ui'
import type { Query } from '@/types'

interface QuerySwitcherProps {
  projectId?: string
  currentQueryId?: string | null
  onSelectQuery: (query: Query | null) => void // null = default (no saved query)
  onSaveQuery: () => void
}

export function QuerySwitcher({
  projectId,
  currentQueryId,
  onSelectQuery,
  onSaveQuery,
}: QuerySwitcherProps) {
  const { data: queries = [], isLoading } = useSavedQueries(projectId)
  const deleteSavedQuery = useDeleteSavedQuery()
  const updateSavedQuery = useUpdateSavedQuery()

  const [showDropdown, setShowDropdown] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  const currentQuery = queries.find((q) => q.id === currentQueryId)

  const handleSelect = (query: Query | null) => {
    onSelectQuery(query)
    setShowDropdown(false)
  }

  const handleDelete = async (e: React.MouseEvent, queryId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this saved query?')) return
    await deleteSavedQuery.mutateAsync(queryId)
    if (currentQueryId === queryId) onSelectQuery(null)
  }

  const handleSetDefault = async (e: React.MouseEvent, queryId: string) => {
    e.stopPropagation()
    await updateSavedQuery.mutateAsync({ id: queryId, data: { isDefault: true } })
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          setMenuAnchor(e.currentTarget)
          setShowDropdown((v) => !v)
        }}
        className={`
          flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${currentQuery ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}
        `}
      >
        {/* Filter icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
          <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-medium truncate max-w-[120px]">
          {currentQuery ? currentQuery.name : 'All work packages'}
        </span>
        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`}>
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          <div
            className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Views</span>
            </div>

            {/* Default "All work packages" option */}
            <MenuItem
              label="All work packages"
              isActive={!currentQueryId}
              isDefault
              onClick={() => handleSelect(null)}
            />

            {/* Saved queries */}
            {queries.map((query) => (
              <div
                key={query.id}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 group ${
                  query.id === currentQueryId ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleSelect(query)}
              >
                <div className="flex-1 min-w-0">
                  <MenuItem
                    label={query.name}
                    isActive={query.id === currentQueryId}
                    isDefault={query.isDefault}
                    onClick={() => {}}
                  />
                </div>

                {/* Query actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  {query.isDefault ? (
                    <span className="text-[10px] text-gray-400 px-1">Default</span>
                  ) : (
                    <button
                      onClick={(e) => { void handleSetDefault(e, query.id) }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Set as default"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => { void handleDelete(e, query.id) }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Delete query"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M2 3L10 10M10 3L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Save current view */}
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => { setShowDropdown(false); onSaveQuery() }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Save current view...
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  label,
  isActive,
  isDefault,
  onClick,
}: {
  label: string
  isActive: boolean
  isDefault?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm py-0.5 flex items-center gap-2 ${
        isActive ? 'text-blue-700 font-semibold' : 'text-gray-700'
      }`}
    >
      {isActive && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="flex-shrink-0">
          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}
      {!isActive && <span className="w-3" />}
      <span className="truncate">{label}</span>
      {isDefault && (
        <span className="ml-auto text-[10px] text-gray-400">★</span>
      )}
    </button>
  )
}
