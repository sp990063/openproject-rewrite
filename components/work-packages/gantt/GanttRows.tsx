import React from 'react'
import { GanttBar } from './GanttBar'
import type { GanttWorkPackage } from './types'
import type { GanttZoomLevel } from '@/lib/gantt/calculate'

interface GanttRowsProps {
  items: GanttWorkPackage[]
  rowMap: Map<string, number>
  rowHeight: number
  zoomLevel: GanttZoomLevel
  selectedIds: Set<string>
  onSelect: (id: string, selected: boolean) => void
  onDatesChange: (id: string, startDate: string | null, dueDate: string | null) => void
  onRowClick: (id: string) => void
  totalWidth: number
}

export function GanttRows({
  items,
  rowMap,
  rowHeight,
  zoomLevel,
  selectedIds,
  onSelect,
  onDatesChange,
  onRowClick,
  totalWidth,
}: GanttRowsProps) {
  // Determine the total number of rows
  const maxRow = items.reduce((max, item) => {
    const row = rowMap.get(item.id) ?? 0
    return Math.max(max, row)
  }, 0)
  const totalRows = maxRow + 1

  return (
    <div className="relative" style={{ height: totalRows * rowHeight, width: totalWidth }}>
      {/* Row background stripes */}
      {Array.from({ length: totalRows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
          style={{
            position: 'absolute',
            top: rowIdx * rowHeight,
            left: 0,
            width: totalWidth,
            height: rowHeight,
          }}
        />
      ))}

      {/* Grid vertical lines */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Lines would be rendered here based on day boundaries */}
      </div>

      {/* Gantt bars */}
      {items.map((item) => {
        const row = rowMap.get(item.id) ?? 0
        return (
          <GanttBar
            key={item.id}
            item={item}
            row={row}
            rowHeight={rowHeight}
            zoomLevel={zoomLevel}
            isSelected={selectedIds.has(item.id)}
            onSelect={onSelect}
            onDatesChange={onDatesChange}
            onClick={onRowClick}
          />
        )
      })}
    </div>
  )
}
