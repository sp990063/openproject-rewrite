import React from 'react'

/** Loading skeleton rows for the work package table */
export function WorkPackageTableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-3 border-b border-gray-100">
        <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
        {[200, 120, 100, 100, 140, 110, 110, 90].map((w, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: w }} />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
          {[220, 100, 80, 80, 120, 90, 90, 60].map((w, j) => (
            <div
              key={j}
              className="h-4 bg-gray-100 rounded animate-pulse"
              style={{ width: w, animationDelay: `${j * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
