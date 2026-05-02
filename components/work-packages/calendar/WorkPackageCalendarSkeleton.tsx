import React from 'react'

export function WorkPackageCalendarSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-8 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center py-2 text-xs text-gray-500 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-r border-gray-100 p-2 min-h-[80px]"
          >
            <div className="h-4 w-4 bg-gray-100 rounded animate-pulse mb-1" />
            <div className="space-y-1">
              {i % 3 === 0 && (
                <div className="h-5 w-full bg-blue-50 rounded animate-pulse" />
              )}
              {i % 5 === 1 && (
                <div className="h-5 w-3/4 bg-green-50 rounded animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
