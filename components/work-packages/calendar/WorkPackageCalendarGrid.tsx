import React, { useMemo } from 'react'
import { format, isSameMonth, isToday, startOfWeek, addDays } from 'date-fns'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import type { WorkPackage } from '@/types'
import type { CalendarViewMode } from './WorkPackageCalendar'

interface WorkPackageCalendarGridProps {
  days: Date[]
  workPackagesByDate: Map<string, WorkPackage[]>
  viewMode: CalendarViewMode
  currentDate: Date
  onEventClick: (wpId: string) => void
}

// ─── CalendarGrid ───────────────────────────────────────────────────────────────

export function WorkPackageCalendarGrid({
  days,
  workPackagesByDate,
  viewMode,
  currentDate,
  onEventClick,
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
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayWps = workPackagesByDate.get(dateKey) ?? []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)

            return (
              <CalendarDayCell
                key={dateKey}
                dateKey={dateKey}
                day={day}
                workPackages={dayWps}
                isCurrentMonth={isCurrentMonth}
                isToday={isDayToday}
                onEventClick={onEventClick}
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

      {/* Week view: 7 equal columns, each independently scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full">
          {weekDaysFull.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayWps = workPackagesByDate.get(dateKey) ?? []

            return (
              <CalendarDayCell
                key={dateKey}
                dateKey={dateKey}
                day={day}
                workPackages={dayWps}
                isCurrentMonth={true}
                isToday={isToday(day)}
                onEventClick={onEventClick}
                compact={false}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── CalendarDayCell ───────────────────────────────────────────────────────────

interface CalendarDayCellProps {
  dateKey: string
  day: Date
  workPackages: WorkPackage[]
  isCurrentMonth: boolean
  isToday: boolean
  onEventClick: (wpId: string) => void
  compact: boolean
}

function CalendarDayCell({
  dateKey,
  day,
  workPackages,
  isCurrentMonth,
  isToday,
  onEventClick,
  compact,
}: CalendarDayCellProps) {
  // Make each day cell a droppable target for drag-and-drop
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { type: 'calendar-cell', date: dateKey },
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col border-b border-r border-gray-100 p-1 min-h-[80px] text-xs
        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
        ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}
        ${isOver ? 'bg-blue-50' : ''}
        transition-colors
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
          <DraggableEventPill
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

// ─── DraggableEventPill ────────────────────────────────────────────────────────

interface DraggableEventPillProps {
  workPackage: WorkPackage
  onClick: () => void
  compact: boolean
}

function DraggableEventPill({ workPackage: wp, onClick, compact }: DraggableEventPillProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: wp.id,
    data: { type: 'work-package', workPackage: wp },
  })

  const color = wp.type?.color ?? wp.status?.color ?? '#6366F1'

  const pill = compact ? (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full text-left truncate rounded px-1 py-0.5 text-[10px] font-medium text-white hover:opacity-90 transition-opacity cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: color, opacity: isDragging ? 0.4 : 1 }}
      title={wp.subject}
    >
      {wp.subject}
    </button>
  ) : (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="w-full text-left rounded px-2 py-1 mb-1 text-xs font-medium text-white hover:opacity-90 transition-opacity shadow-sm cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: color, opacity: isDragging ? 0.4 : 1 }}
      title={wp.subject}
    >
      {wp.subject}
    </button>
  )

  return pill
}
