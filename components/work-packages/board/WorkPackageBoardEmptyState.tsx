import React from 'react'
import { Button } from '@/components/ui'

interface WorkPackageBoardEmptyStateProps {
  onCreateFirst?: () => void
}

export function WorkPackageBoardEmptyState({ onCreateFirst }: WorkPackageBoardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Kanban board illustration */}
      <div className="mb-6 opacity-40">
        <svg width="80" height="60" viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Column 1 */}
          <rect x="2" y="2" width="22" height="56" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1"/>
          <rect x="5" y="8" width="16" height="12" rx="2" fill="#D1D5DB"/>
          <rect x="5" y="24" width="16" height="12" rx="2" fill="#D1D5DB"/>
          {/* Column 2 */}
          <rect x="29" y="2" width="22" height="56" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1"/>
          <rect x="32" y="8" width="16" height="12" rx="2" fill="#D1D5DB"/>
          {/* Column 3 */}
          <rect x="56" y="2" width="22" height="56" rx="4" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="1"/>
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">No work packages in this view</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        There are no work packages matching your current board view. Try adjusting your filters or create a new work package.
      </p>
      {onCreateFirst && (
        <Button variant="primary" size="sm" onClick={onCreateFirst}>
          + Create work package
        </Button>
      )}
    </div>
  )
}
