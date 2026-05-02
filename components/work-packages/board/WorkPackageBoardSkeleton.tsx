import React from 'react'

export function WorkPackageBoardSkeleton() {
  const COLUMNS = 4
  const CARDS_PER_COLUMN = [3, 2, 4, 1]

  return (
    <div className="flex gap-4 p-4 overflow-x-auto">
      {Array.from({ length: COLUMNS }).map((_, colIdx) => (
        <div key={colIdx} className="flex-shrink-0 w-64">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-6 bg-gray-100 rounded-full animate-pulse" />
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {Array.from({ length: CARDS_PER_COLUMN[colIdx] }).map((_, cardIdx) => (
              <div key={cardIdx} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                {/* Type badge + priority */}
                <div className="flex items-center justify-between mb-2">
                  <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-3 bg-gray-100 rounded-full animate-pulse" />
                </div>
                {/* Subject */}
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse mb-1" />
                <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse mb-3" />
                {/* Assignee + dates */}
                <div className="flex items-center justify-between">
                  <div className="h-5 w-5 bg-gray-100 rounded-full animate-pulse" />
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
