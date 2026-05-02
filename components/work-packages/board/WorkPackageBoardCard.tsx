import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import type { WorkPackage } from '@/types'

interface WorkPackageBoardCardProps {
  workPackage: WorkPackage
  isDragging?: boolean
}

export function WorkPackageBoardCard({ workPackage: wp, isDragging }: WorkPackageBoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: wp.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  }

  const typeColor = wp.type?.color ?? '#6366F1'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative bg-white rounded-lg border border-gray-200 p-3
        cursor-grab active:cursor-grabbing
        hover:border-gray-300 hover:shadow-sm
        transition-all duration-150
        ${isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-2 scale-105' : ''}
      `}
    >
      {/* Type badge */}
      {wp.type && (
        <div
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold mb-2 text-white"
          style={{ backgroundColor: typeColor }}
        >
          {wp.type.name}
        </div>
      )}

      {/* Subject */}
      <div className="text-sm font-medium text-gray-900 leading-snug mb-2 pr-4">
        <a
          href={`#`}
          className="hover:text-blue-600"
          onClick={(e) => e.stopPropagation()}
        >
          {wp.subject}
        </a>
      </div>

      {/* Bottom row: assignee + due date */}
      <div className="flex items-center justify-between mt-1">
        {/* Assignee */}
        <div>
          {wp.assignee ? (
            <div className="flex items-center gap-1.5">
              {/* Avatar placeholder */}
              <div
                className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: stringToColor(wp.assignee.name) }}
                title={wp.assignee.name}
              >
                {wp.assignee.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-gray-500 truncate max-w-[80px]">
                {wp.assignee.name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-300 italic">Unassigned</span>
          )}
        </div>

        {/* Due date */}
        {wp.dueDate && (
          <div className="text-xs text-gray-400 flex-shrink-0">
            {format(wp.dueDate instanceof Date ? wp.dueDate : new Date(wp.dueDate), 'MMM d')}
          </div>
        )}
      </div>

      {/* Drag handle indicator (visible on hover) */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="3" r="1" />
          <circle cx="9" cy="3" r="1" />
          <circle cx="3" cy="6" r="1" />
          <circle cx="9" cy="6" r="1" />
          <circle cx="3" cy="9" r="1" />
          <circle cx="9" cy="9" r="1" />
        </svg>
      </div>
    </div>
  )
}

/** Generate a consistent color from a string (for avatar backgrounds) */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  return colors[Math.abs(hash) % colors.length]
}
