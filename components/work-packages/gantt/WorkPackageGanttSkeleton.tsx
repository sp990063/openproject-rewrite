import React from 'react'

export function WorkPackageGanttSkeleton() {
  const ROWS = 8

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Timeline header */}
      <div className="flex border-b border-gray-200">
        {/* Row label column */}
        <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-gray-200 bg-gray-50">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Timeline grid */}
        <div className="flex-1 flex">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-10 border-r border-gray-100 ${i === 14 ? 'bg-blue-50/30' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: ROWS }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex flex-1 min-h-[45px] border-b border-gray-100">
          {/* Row label */}
          <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-gray-100 rounded animate-pulse flex-shrink-0" />
              <div className={`h-4 bg-gray-100 rounded animate-pulse ${rowIdx % 3 === 0 ? 'w-32' : rowIdx % 3 === 1 ? 'w-24' : 'w-28'}`} />
            </div>
          </div>
          {/* Timeline row */}
          <div className="flex-1 relative flex items-center">
            {rowIdx % 3 === 0 && (
              <div
                className="absolute h-5 bg-blue-100 rounded animate-pulse"
                style={{ left: `${(rowIdx * 7) % 40}%`, width: `${20 + (rowIdx * 5) % 20}%` }}
              />
            )}
            {rowIdx % 3 === 1 && (
              <div
                className="absolute h-5 bg-green-100 rounded animate-pulse"
                style={{ left: `${(rowIdx * 12) % 30}%`, width: `${15 + (rowIdx * 8) % 25}%` }}
              />
            )}
            {rowIdx % 3 === 2 && (
              <div
                className="absolute h-5 bg-purple-100 rounded animate-pulse"
                style={{ left: `${(rowIdx * 5) % 50}%`, width: `${30 + rowIdx * 3}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
