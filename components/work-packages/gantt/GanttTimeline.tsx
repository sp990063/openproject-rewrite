import React from 'react'
import {
  format,
  addDays,
  startOfMonth,
  startOfWeek,
  differenceInDays,
  isToday,
  isWeekend,
} from 'date-fns'
import type { GanttZoomLevel } from './types'

interface GanttTimelineProps {
  viewportStart: Date
  viewportEnd: Date
  zoomLevel: GanttZoomLevel
  dayWidth: number
  totalDays: number
}

/**
 * Renders the timeline header with date labels that change based on zoom level.
 * - Day view: shows individual days
 * - Week view: shows week numbers
 * - Month view: shows month names
 * - Quarter view: shows month names
 */
export function GanttTimeline({
  viewportStart,
  viewportEnd,
  zoomLevel,
  dayWidth,
  totalDays,
}: GanttTimelineProps) {
  const days = Array.from({ length: totalDays }, (_, i) => addDays(viewportStart, i))

  return (
    <div className="flex flex-col border-b border-gray-200 bg-white sticky top-0 z-20">
      {/* Row 1: Month labels (all zoom levels) */}
      <TimelineMonthRow
        days={days}
        viewportStart={viewportStart}
        dayWidth={dayWidth}
        zoomLevel={zoomLevel}
      />

      {/* Row 2: Week / Day labels */}
      {zoomLevel === 'day' && (
        <TimelineDayRow days={days} dayWidth={dayWidth} />
      )}
      {zoomLevel === 'week' && (
        <TimelineWeekRow days={days} viewportStart={viewportStart} dayWidth={dayWidth} />
      )}
    </div>
  )
}

// ─── Month Row ────────────────────────────────────────────────────────────────

function TimelineMonthRow({
  days,
  viewportStart,
  dayWidth,
  zoomLevel,
}: {
  days: Date[]
  viewportStart: Date
  dayWidth: number
  zoomLevel: GanttZoomLevel
}) {
  // Group days by month
  const months: { date: Date; daysInSpan: number }[] = []
  for (const day of days) {
    const monthStart = startOfMonth(day)
    const existing = months.find(
      (m) => m.date.getFullYear() === monthStart.getFullYear() && m.date.getMonth() === monthStart.getMonth()
    )
    if (existing) {
      existing.daysInSpan++
    } else {
      months.push({ date: monthStart, daysInSpan: 1 })
    }
  }

  return (
    <div className="relative flex h-6 border-b border-gray-100 overflow-hidden">
      {months.map(({ date, daysInSpan }, idx) => {
        const left = days.findIndex(
          (d) =>
            d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth()
        )
        const offset = left * dayWidth
        const width = daysInSpan * dayWidth

        return (
          <div
            key={idx}
            className="absolute top-0 flex items-center text-xs font-semibold text-gray-600 overflow-hidden"
            style={{ left: offset, width, height: '100%' }}
          >
            <span className="pl-2 truncate">
              {zoomLevel === 'quarter'
                ? format(date, 'MMM yyyy')
                : format(date, 'MMMM yyyy')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Day Row ──────────────────────────────────────────────────────────────────

function TimelineDayRow({ days, dayWidth }: { days: Date[]; dayWidth: number }) {
  return (
    <div className="flex h-5">
      {days.map((day, i) => {
        const isWknd = isWeekend(day)
        const isTdy = isToday(day)

        return (
          <div
            key={i}
            className="flex-shrink-0 flex items-center justify-center text-[10px] leading-none"
            style={{ width: dayWidth }}
          >
            <span
              className={`font-medium ${isTdy ? 'text-red-600 font-bold' : isWknd ? 'text-gray-400' : 'text-gray-500'}`}
            >
              {format(day, 'd')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Week Row ─────────────────────────────────────────────────────────────────

function TimelineWeekRow({
  days,
  viewportStart,
  dayWidth,
}: {
  days: Date[]
  viewportStart: Date
  dayWidth: number
}) {
  // Group into weeks
  const weeks: { start: Date; days: Date[] }[] = []
  for (const day of days) {
    const weekStart = startOfWeek(day, { weekStartsOn: 1 })
    const existing = weeks.find(
      (w) => startOfWeek(w.start, { weekStartsOn: 1 }).getTime() === weekStart.getTime()
    )
    if (existing) {
      existing.days.push(day)
    } else {
      weeks.push({ start: weekStart, days: [day] })
    }
  }

  return (
    <div className="flex h-5">
      {weeks.map(({ start, days: weekDays }, idx) => {
        const left = differenceInDays(start, viewportStart) * dayWidth
        const width = weekDays.length * dayWidth

        return (
          <div
            key={idx}
            className="flex-shrink-0 flex items-center justify-center text-[10px] text-gray-500 font-medium overflow-hidden"
            style={{ width }}
          >
            W{format(start, 'w')}
          </div>
        )
      })}
    </div>
  )
}
