import React from 'react'
import type { Status } from '@/types'

interface WorkPackageBoardColumnHeaderProps {
  status: Status
  count: number
  wipLimit: number | null
  isOverLimit: boolean
  isAtLimit: boolean
}

export function WorkPackageBoardColumnHeader({
  status,
  count,
  wipLimit,
  isOverLimit,
  isAtLimit,
}: WorkPackageBoardColumnHeaderProps) {
  const limitColor = isOverLimit
    ? 'text-red-600'
    : isAtLimit
    ? 'text-yellow-600'
    : 'text-gray-500'

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="flex items-center gap-2 min-w-0">
        {/* Status color dot */}
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color ?? '#6B7280' }}
        />
        <span className="text-sm font-semibold text-gray-800 truncate">{status.name}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* WIP limit indicator */}
        {wipLimit !== null && (
          <span
            className={`text-xs font-medium ${limitColor}`}
            title={`WIP limit: ${count} / ${wipLimit}`}
          >
            {count}/{wipLimit}
          </span>
        )}
        {wipLimit === null && (
          <span className="text-xs text-gray-400">{count}</span>
        )}

        {/* WIP limit color warning dot */}
        {isOverLimit && (
          <span className="h-2 w-2 rounded-full bg-red-500" title="Over WIP limit" />
        )}
        {isAtLimit && !isOverLimit && (
          <span className="h-2 w-2 rounded-full bg-yellow-400" title="At WIP limit" />
        )}
      </div>
    </div>
  )
}
