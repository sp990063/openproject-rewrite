'use client'

import React from 'react'
import { Button } from '@/components/ui'

const SUBJECT_TYPES = [
  { value: 'work_package', label: 'Work packages' },
  { value: 'wiki_page', label: 'Wiki pages' },
  { value: 'forum_post', label: 'Forum posts' },
  { value: 'document', label: 'Documents' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'news', label: 'News' },
  { value: 'time_entry', label: 'Time entries' },
  { value: 'member', label: 'Members' },
  { value: 'version', label: 'Versions' },
]

interface ActivityFiltersProps {
  selectedFilters: string[]
  onChange: (filters: string[]) => void
  includeArchived: boolean
  onIncludeArchivedChange: (include: boolean) => void
  onClearAll: () => void
}

export function ActivityFilters({
  selectedFilters,
  onChange,
  includeArchived,
  onIncludeArchivedChange,
  onClearAll,
}: ActivityFiltersProps) {
  const handleFilterToggle = (value: string) => {
    if (selectedFilters.includes(value)) {
      onChange(selectedFilters.filter((f) => f !== value))
    } else {
      onChange([...selectedFilters, value])
    }
  }

  const handleSelectAll = () => {
    onChange(SUBJECT_TYPES.map((t) => t.value))
  }

  const hasFilters = selectedFilters.length > 0 || includeArchived

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">Filters</h3>
        {hasFilters && (
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Activity Types */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Activity Types
          </span>
          <button
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Select all
          </button>
        </div>

        <div className="space-y-1">
          {SUBJECT_TYPES.map((type) => (
            <label
              key={type.value}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedFilters.includes(type.value)}
                onChange={() => handleFilterToggle(type.value)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                {type.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Show Archived Toggle */}
      <div className="pt-4 border-t border-gray-100">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => onIncludeArchivedChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            Show archived
          </span>
        </label>
      </div>

      {/* Active filter count */}
      {selectedFilters.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          Showing {selectedFilters.length} type{selectedFilters.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
