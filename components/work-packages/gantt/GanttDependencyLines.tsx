import React from 'react'
import { calculatePath, calculateArrowHead, type GanttDependency, type GanttWorkPackage } from './types'

interface GanttDependencyLinesProps {
  dependencies: GanttDependency[]
  workPackagesMap: Map<string, GanttWorkPackage>
  rowMap: Map<string, number>
  rowHeight: number
  totalHeight: number
  totalWidth: number
}

export function GanttDependencyLines({
  dependencies,
  workPackagesMap,
  rowMap,
  rowHeight,
  totalHeight,
  totalWidth,
}: GanttDependencyLinesProps) {
  return (
    <svg
      className="gantt-dependencies absolute inset-0 pointer-events-none"
      style={{ height: totalHeight, width: totalWidth }}
      aria-hidden="true"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#6B7280" />
        </marker>
      </defs>

      {dependencies.map((dep) => {
        const from = workPackagesMap.get(dep.fromId)
        const to = workPackagesMap.get(dep.toId)
        if (!from || !to) return null

        const fromRow = rowMap.get(dep.fromId) ?? 0
        const toRow = rowMap.get(dep.toId) ?? 0

        const path = calculatePath(
          { left: from.left, width: from.width, row: fromRow },
          { left: to.left, width: to.width, row: toRow },
          dep.type,
          rowHeight
        )

        // Arrow at the end
        const arrowHead = (() => {
          const [endX, endY] = (() => {
            const parts = path.split(' ').filter((p) => p.startsWith('L'))
            if (!parts.length) return [0, 0]
            const last = parts[parts.length - 1]
            const coords = last.split(' ').slice(1).map(Number)
            return coords as [number, number]
          })()
          return calculateArrowHead(endX, endY, 8)
        })()

        return (
          <g key={`${dep.fromId}-${dep.toId}`}>
            {/* Main line */}
            <path
              d={path}
              fill="none"
              stroke="#9CA3AF"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          </g>
        )
      })}
    </svg>
  )
}
