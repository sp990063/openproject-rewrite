import React from 'react'
import { Button } from '@/components/ui'

interface WorkPackageCalendarEmptyStateProps {
  onCreateFirst?: () => void
}

export function WorkPackageCalendarEmptyState({ onCreateFirst }: WorkPackageCalendarEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* Calendar illustration */}
      <div className="mb-6 opacity-40">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="8" width="56" height="52" rx="6" fill="#E5E7EB" stroke="#D1D5DB" strokeWidth="2"/>
          <rect x="4" y="8" width="56" height="14" rx="6" fill="#D1D5DB"/>
          <rect x="4" y="14" width="56" height="8" fill="#D1D5DB"/>
          {/* Day labels */}
          {[16, 26, 36, 46, 56].map((x, i) => (
            <rect key={i} x={x} y={12} width={8} height={3} rx="1" fill="#9CA3AF"/>
          ))}
          {/* Grid cells */}
          {[0,1,2,3,4,5].map((row) =>
            [16,26,36,46,56].map((x, col) => (
              <rect key={`${row}-${col}`} x={x} y={26 + row * 7} width={8} height={6} rx="1" fill="#F3F4F6"/>
            ))
          )}
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">No work packages this month</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        There are no work packages scheduled for this month. Navigate to another month or create a new work package.
      </p>
      {onCreateFirst && (
        <Button variant="primary" size="sm" onClick={onCreateFirst}>
          + Create work package
        </Button>
      )}
    </div>
  )
}
