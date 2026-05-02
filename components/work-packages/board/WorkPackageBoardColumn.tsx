import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { WorkPackageBoardCard } from './WorkPackageBoardCard'
import { WorkPackageBoardColumnHeader } from './WorkPackageBoardColumnHeader'
import type { BoardColumn } from './types'

interface WorkPackageBoardColumnProps {
  column: BoardColumn
  onAddCard?: (statusId: string) => void
}

export function WorkPackageBoardColumn({ column, onAddCard }: WorkPackageBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.statusId,
    data: { type: 'column', statusId: column.statusId },
  })

  const wpIds = column.workPackages.map((wp) => wp.id)

  return (
    <div
      className={`
        flex flex-col flex-shrink-0 w-72 rounded-xl border border-gray-200
        bg-gray-50/50 overflow-hidden
        transition-colors duration-150
        ${isOver ? 'border-blue-400 bg-blue-50/30' : ''}
        ${column.isOverLimit ? 'ring-2 ring-red-200' : ''}
      `}
      style={{ maxHeight: 'calc(100vh - 140px)' }}
    >
      {/* Column header */}
      <WorkPackageBoardColumnHeader
        status={column.status}
        count={column.workPackages.length}
        wipLimit={column.wipLimit}
        isOverLimit={column.isOverLimit}
        isAtLimit={column.isAtLimit}
      />

      {/* WIP warning banner */}
      {column.isOverLimit && (
        <div className="mx-2 mt-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-600 font-medium">
          ⚠️ Over WIP limit ({column.workPackages.length} / {column.wipLimit})
        </div>
      )}

      {/* Cards list */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
      >
        <SortableContext items={wpIds} strategy={verticalListSortingStrategy}>
          {column.workPackages.map((wp) => (
            <WorkPackageBoardCard key={wp.id} workPackage={wp} />
          ))}
        </SortableContext>

        {column.workPackages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-2">
              <rect x="4" y="8" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="4" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>No items</span>
          </div>
        )}
      </div>

      {/* Add card button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={() => onAddCard?.(column.statusId)}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span>Add</span>
        </button>
      </div>
    </div>
  )
}
