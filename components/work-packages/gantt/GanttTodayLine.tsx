import React from 'react'
import { differenceInDays } from 'date-fns'

interface GanttTodayLineProps {
  viewportStart: Date
  dayWidth: number
  /** Total height of the Gantt chart in pixels */
  totalHeight: number
}

export function GanttTodayLine({ viewportStart, dayWidth, totalHeight }: GanttTodayLineProps) {
  const today = new Date()
  const daysFromStart = differenceInDays(today, viewportStart)
  const x = daysFromStart * dayWidth

  // Only render if today is within the visible viewport
  if (x < 0) return null

  return (
    <g className="gantt-today-line" aria-label="Today">
      {/* Red vertical line */}
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={totalHeight}
        stroke="#EF4444"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      {/* "Today" label */}
      <rect
        x={x - 16}
        y={0}
        width={32}
        height={18}
        fill="#EF4444"
        rx={3}
      />
      <text
        x={x}
        y={12}
        textAnchor="middle"
        fill="white"
        fontSize={10}
        fontWeight={600}
        fontFamily="sans-serif"
      >
        Today
      </text>
    </g>
  )
}
