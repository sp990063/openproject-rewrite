import React from 'react'
import { Button } from '@/components/ui'

interface WorkPackageGanttEmptyStateProps {
  onCreateFirst?: () => void
}

export function WorkPackageGanttEmptyState({ onCreateFirst }: WorkPackageGanttEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Gantt chart illustration */}
      <div className="mb-6 opacity-40">
        <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Timeline axis */}
          <line x1="0" y1="10" x2="120" y2="10" stroke="#D1D5DB" strokeWidth="1"/>
          {/* Today line */}
          <line x1="60" y1="4" x2="60" y2="60" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="3 2"/>
          {/* Bars */}
          <rect x="20" y="20" width="30" height="8" rx="2" fill="#D1D5DB"/>
          <rect x="35" y="32" width="40" height="8" rx="2" fill="#D1D5DB"/>
          <rect x="15" y="44" width="25" height="8" rx="2" fill="#D1D5DB"/>
          <rect x="55" y="44" width="20" height="8" rx="2" fill="#D1D5DB"/>
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">No work packages to display</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        There are no work packages with dates set. Assign start and due dates to see them on the Gantt chart.
      </p>
      {onCreateFirst && (
        <Button variant="primary" size="sm" onClick={onCreateFirst}>
          + Create work package
        </Button>
      )}
    </div>
  )
}
