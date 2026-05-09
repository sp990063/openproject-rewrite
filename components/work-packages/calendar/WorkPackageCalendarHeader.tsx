import React from 'react'
import { format } from 'date-fns'

export type CalendarViewMode = 'month' | 'week'

interface WorkPackageCalendarHeaderProps {
  currentDate: Date
  viewMode: CalendarViewMode
  onViewModeChange: (mode: CalendarViewMode) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function WorkPackageCalendarHeader({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
}: WorkPackageCalendarHeaderProps) {
  const dateLabel =
    viewMode === 'month'
      ? format(currentDate, 'MMMM yyyy')
      : `Week of ${format(currentDate, 'MMM d, yyyy')}`

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-800">{dateLabel}</h2>
        <button
          onClick={onToday}
          className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Today
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Navigation arrows */}
        <button
          onClick={onPrev}
          aria-label="Previous"
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onNext}
          aria-label="Next"
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* View mode toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden ml-2">
          <button
            onClick={() => onViewModeChange('month')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'week'
                ? 'bg-gray-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Week
          </button>
        </div>
      </div>
    </div>
  )
}
