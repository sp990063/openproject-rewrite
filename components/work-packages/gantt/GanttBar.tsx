import React, { useState, useRef, useCallback } from 'react'
import type { GanttWorkPackage } from './types'
import { computeResizeDates, getDayWidth } from './types'
import type { GanttZoomLevel } from '@/lib/gantt/calculate'

interface GanttBarProps {
  item: GanttWorkPackage
  row: number
  rowHeight: number
  zoomLevel: GanttZoomLevel
  isSelected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  onDatesChange?: (id: string, startDate: string | null, dueDate: string | null) => void
  onClick?: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  // Fallback colors by status name patterns
  done:     '#22C55E',
  closed:   '#6B7280',
  progress: '#3B82F6',
  default:  '#6366F1',
}

export function GanttBar({
  item,
  row,
  rowHeight,
  zoomLevel,
  isSelected,
  onSelect,
  onDatesChange,
  onClick,
}: GanttBarProps) {
  const barTop = row * rowHeight + 8
  const barHeight = rowHeight - 16
  const barColor = item.status?.color ?? STATUS_COLORS.default

  // Drag resize state
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null)
  const dragStartX = useRef(0)
  const dragStartLeft = useRef(item.left)
  const dragStartWidth = useRef(item.width)

  const dayWidth = getDayWidth(zoomLevel)

  const handleMouseDown = useCallback(
    (edge: 'left' | 'right') => (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(edge)
      dragStartX.current = e.clientX
      dragStartLeft.current = item.left
      dragStartWidth.current = item.width

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - dragStartX.current

        if (edge === 'left') {
          const newLeft = Math.max(0, dragStartLeft.current + delta)
          // We update via onDatesChange on mouseUp
          void newLeft
        } else {
          const newWidth = Math.max(dayWidth, dragStartWidth.current + delta)
          void newWidth
        }
      }

      const handleMouseUp = (e: MouseEvent) => {
        const delta = e.clientX - dragStartX.current
        setIsDragging(null)

        if (Math.abs(delta) < 4) {
          // Treat as a click, not a drag
          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('mouseup', handleMouseUp)
          return
        }

        if (onDatesChange) {
          const result = computeResizeDates(
            item.startDate ?? null,
            item.dueDate ?? null,
            delta,
            dayWidth,
            edge
          )
          onDatesChange(item.id, result.newStartDate, result.newDueDate)
        }

        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [item, dayWidth, onDatesChange]
  )

  const progressWidth = Math.round((item.progress / 100) * item.width)

  return (
    <div
      className="absolute rounded cursor-pointer group select-none"
      style={{
        left: item.left,
        top: barTop,
        width: item.width,
        height: barHeight,
        backgroundColor: barColor + '30',
        borderLeft: `3px solid ${barColor}`,
        borderRight: `1px solid ${barColor}40`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick(item.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        // Double-click to open detail
        if (onClick) onClick(item.id)
      }}
      role="button"
      aria-label={`${item.subject} (${item.status?.name ?? 'No status'})`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onClick) onClick(item.id)
      }}
    >
      {/* Progress fill */}
      <div
        className="absolute top-0 left-0 h-full rounded-l opacity-40"
        style={{
          width: progressWidth,
          backgroundColor: barColor,
        }}
      />

      {/* Label */}
      <div
        className="relative px-1.5 text-xs font-medium text-gray-800 truncate leading-7"
        style={{ height: barHeight }}
      >
        <span className="truncate">{item.subject}</span>
      </div>

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500/20 rounded-l"
        onMouseDown={handleMouseDown('left')}
        aria-label="Drag to resize from left"
      />

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500/20 rounded-r"
        onMouseDown={handleMouseDown('right')}
        aria-label="Drag to resize from right"
      />

      {/* Selection ring */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none" />
      )}

      {/* Drag ghost */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/30 border border-blue-500 rounded pointer-events-none animate-pulse" />
      )}
    </div>
  )
}
