import React, { useMemo } from 'react'
import { format, isSameMonth, isToday, startOfWeek, addDays } from 'date-fns'
import type { WorkPackage } from '@/types'
import type { CalendarViewMode } from './WorkPackageCalendar'

interface WorkPackageCalendarGridProps {
  days: Date[]
  workPackagesByDate: Map<string, WorkPackage[]>
  viewMode: CalendarViewMode
  currentDate: Date
  onEventClick: (wpId: string) => void
  onEventDrop: (wpId: string, newDate: Date) => void
}

export function WorkPackageCalendarGrid({
  days,
  workPackagesByDate,
  viewMode,
  currentDate,
  onEventClick,
  onEventDrop,
}: WorkPackageCalendarGridProps) {
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (viewMode === 'month') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="grid grid-cols-7 flex-1 overflow-auto">
          {days.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayWps = workPackagesByDate.get(dateKey) ?? []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)

            return (
              <CalendarDayCell
                key={dateKey}
                day={day}
                workPackages={dayWps}
                isCurrentMonth={isCurrentMonth}
                isToday={isDayToday}
                onEventClick={onEventClick}
                onEventDrop={onEventDrop}
                compact
              />
            )
          })}
        </div>
      </div>
    )
  }

  // Week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDaysFull = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        {weekDaysFull.map((day) => (
          <div
            key={format(day, 'yyyy-MM-dd')}
            className={`py-2 text-center text-xs font-semibold tracking-wide ${
              isToday(day) ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="uppercase">{format(day, 'EEE')}</div>
            <div className={`text-sm mt-0.5 ${isToday(day) ? 'font-bold' : ''}`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Hourly rows */}
      <div className="flex-1 overflow-auto">
        {weekDaysFull.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const dayWps = workPackagesByDate.get(dateKey) ?? []

          return (
            <div
              key={dateKey}
              className="flex flex-col border-r border-gray-100 min-h-[120px]"
            >
              {dayWps.map((wp) => (
                <CalendarEventPill
                  key={wp.id}
                  workPackage={wp}
                  onClick={() => onEventClick(wp.id)}
                  compact={false}
                />
              ))}
              {dayWps.length === 0 && (
                <div className="flex-1 p-2 text-xs text-gray-300 italic">
                  No events
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CalendarDayCell ───────────────────────────────────────────────────────────

interface CalendarDayCellProps {
  day: Date
  workPackages: WorkPackage[]
  isCurrentMonth: boolean
  isToday: boolean
  onEventClick: (wpId: string) => void
  onEventDrop: (wpId: string, newDate: Date) => void
  compact: boolean
}

function CalendarDayCell({
  day,
  workPackages,
  isCurrentMonth,
  isToday,
  onEventClick,
  compact,
}: CalendarDayCellProps) {
  return (
    <div
      className={`
        flex flex-col border-b border-r border-gray-100 p-1 min-h-[80px] text-xs
        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
        ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}
      `}
    >
      {/* Date number */}
      <div
        className={`
          flex items-center justify-center w-6 h-6 rounded-full mb-1 flex-shrink-0
          text-xs font-medium
          ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
        `}
      >
        {format(day, 'd')}
      </div>

      {/* Work package events */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {workPackages.slice(0, compact ? 3 : 10).map((wp) => (
          <CalendarEventPill
            key={wp.id}
            workPackage={wp}
            onClick={() => onEventClick(wp.id)}
            compact={compact}
          />
        ))}
        {workPackages.length > (compact ? 3 : 10) && (
          <div className="text-[10px] text-gray-400 pl-1">
            +{workPackages.length - (compact ? 3 : 10)} more
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CalendarEventPill ─────────────────────────────────────────────────────────

interface CalendarEventPillProps {
  workPackage: WorkPackage
  onClick: () => void
  compact: boolean
}

function CalendarEventPill({ workPackage: wp, onClick, compact }: CalendarEventPillProps) {
  const color = wp.type?.color ?? wp.status?.color ?? '#6366F1'

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: color }}
        title={wp.subject}
      >
        {wp.subject}
      </button>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded px-2 py-1 mb-1 text-xs font-medium text-white hover:opacity-90 transition-opacity shadow-sm"
      style={{ backgroundColor: color }}
      title={wp.subject}
    >
      {wp.subject}
    </button>
  )
}
