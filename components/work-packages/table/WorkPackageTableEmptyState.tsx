import React from 'react'
import { Button } from '@/components/ui'

interface WorkPackageTableEmptyStateProps {
  onClearFilters: () => void
  hasFilters: boolean
}

export function WorkPackageTableEmptyState({ onClearFilters, hasFilters }: WorkPackageTableEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="text-gray-300"
        >
          <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="8" y1="26" x2="56" y2="26" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="16" x2="20" y2="52" stroke="currentColor" strokeWidth="2" />
          <circle cx="44" cy="38" r="8" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="44" x2="56" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-700 mb-2">No work packages found</h3>
      <p className="text-gray-500 mb-6 max-w-sm">
        {hasFilters
          ? 'No work packages match your current filters. Try adjusting or clearing the filters.'
          : 'There are no work packages in this project yet. Create your first one to get started.'}
      </p>
      <div className="flex gap-3">
        {hasFilters && (
          <Button variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
        {!hasFilters && (
          <Button variant="primary" onClick={() => {/* TODO: open create modal */}}>
            Create work package
          </Button>
        )}
      </div>
    </div>
  )
}
