import React, { useCallback, useRef, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { WorkPackageRow, ColumnId } from './types'
import type { Status, Type, Priority, User } from '@/types'
import {
  StatusBadgeDisplay,
  InlineCellDisplay,
  type InlineEditSaveEvent,
} from './WorkPackageInlineEdit'

interface WorkPackageTableRowProps {
  row: WorkPackageRow
  columns: import('./types').Column[]
  isSelected: boolean
  editing: { rowId: string; columnId: ColumnId } | null
  onSelect: (id: string, selected: boolean) => void
  onEditCell: (rowId: string, columnId: ColumnId, cellRect: DOMRect | null) => void
  onSaveEdit: (event: InlineEditSaveEvent) => Promise<boolean>
  onCancelEdit: () => void
  editingCellRect: DOMRect | null
  /** Options for inline-edit dropdowns */
  statuses: Status[]
  types: Type[]
  priorities: Priority[]
  assignees: User[]
}

export function WorkPackageTableRow({
  row,
  columns,
  isSelected,
  editing,
  onSelect,
  onEditCell,
  onSaveEdit,
  onCancelEdit,
  editingCellRect,
  statuses,
  types,
  priorities,
  assignees,
}: WorkPackageTableRowProps) {
  const { workPackage: wp, depth } = row
  const rowRef = useRef<HTMLTableRowElement>(null)

  const isEditingThisRow = editing?.rowId === wp.id

  /** Get the current value for a column */
  const getColumnValue = useCallback(
    (columnId: ColumnId): unknown => {
      switch (columnId) {
        case 'subject': return wp.subject
        case 'status': return wp.statusId
        case 'type': return wp.typeId
        case 'priority': return wp.priorityId
        case 'assignee': return wp.assigneeId
        case 'startDate': return wp.startDate ? formatDate(wp.startDate) : null
        case 'dueDate': return wp.dueDate ? formatDate(wp.dueDate) : null
        case 'estimatedHours': return wp.estimatedHours
        default: return null
      }
    },
    [wp]
  )

  /** Get the display node for a column */
  const getColumnDisplay = useCallback(
    (columnId: ColumnId): React.ReactNode => {
      switch (columnId) {
        case 'subject':
          return (
            <span className="flex items-center gap-2">
              {depth > 0 && (
                <span
                  className="text-gray-400 text-xs"
                  style={{ paddingLeft: `${depth * 20}px` }}
                >
                  {'—'.repeat(depth)}&nbsp;
                </span>
              )}
              <a
                href={`/projects/${wp.projectId}/work-packages/${wp.id}`}
                className="hover:text-blue-600 hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {wp.subject}
              </a>
            </span>
          )

        case 'status':
          return wp.status ? (
            <StatusBadgeDisplay
              status={wp.status}
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="status"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'status', rect)
              }}
            />
          ) : null

        case 'type':
          return wp.type ? (
            <InlineCellDisplay
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="type"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'type', rect)
              }}
            >
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: (wp.type.color ?? '#666') + '20',
                  color: wp.type.color ?? '#666',
                }}
              >
                {wp.type.name}
              </span>
            </InlineCellDisplay>
          ) : null

        case 'priority':
          return wp.priority ? (
            <InlineCellDisplay
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="priority"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'priority', rect)
              }}
            >
              {wp.priority.name}
            </InlineCellDisplay>
          ) : null

        case 'assignee':
          return (
            <InlineCellDisplay
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="assignee"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'assignee', rect)
              }}
            >
              {wp.assignee?.name ?? (
                <span className="text-gray-400 italic">Unassigned</span>
              )}
            </InlineCellDisplay>
          )

        case 'startDate':
          return (
            <InlineCellDisplay
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="startDate"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'startDate', rect)
              }}
            >
              {wp.startDate ? (
                <span className="text-gray-700">{formatDate(wp.startDate)}</span>
              ) : (
                <span className="text-gray-400 italic">No date</span>
              )}
            </InlineCellDisplay>
          )

        case 'dueDate':
          return (
            <InlineCellDisplay
              isSelected={isSelected}
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="dueDate"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'dueDate', rect)
              }}
            >
              {wp.dueDate ? (
                <span className="text-gray-700">{formatDate(wp.dueDate)}</span>
              ) : (
                <span className="text-gray-400 italic">No date</span>
              )}
            </InlineCellDisplay>
          )

        case 'estimatedHours':
          return (
            <InlineCellDisplay
              isSelected={isSelected}
              align="right"
              onDoubleClick={() => {
                const td = rowRef.current?.querySelector(`[data-col="estimatedHours"]`)
                const rect = td?.getBoundingClientRect() ?? null
                onEditCell(wp.id, 'estimatedHours', rect)
              }}
            >
              {wp.estimatedHours != null ? (
                <span className="text-gray-700 tabular-nums">{wp.estimatedHours}h</span>
              ) : (
                <span className="text-gray-400 italic">—</span>
              )}
            </InlineCellDisplay>
          )

        default:
          return null
      }
    },
    [wp, depth, isSelected, onEditCell]
  )

  const isInlineEditing = (columnId: ColumnId) =>
    isEditingThisRow && editing?.columnId === columnId

  return (
    <tr
      ref={rowRef}
      data-wp-id={wp.id}
      className={cn(
        'border-b border-gray-100 hover:bg-gray-50/80 transition-colors',
        isSelected && 'bg-blue-50/60',
        isEditingThisRow && 'bg-blue-50/30'
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          checked={isSelected}
          onChange={(e) => onSelect(wp.id, e.target.checked)}
          aria-label={`Select ${wp.subject}`}
        />
      </td>

      {/* Data columns */}
      {columns.map((col) => {
        const inlineEditing = isInlineEditing(col.id)

        // Status column uses a special display component
        if (col.id === 'status' && !inlineEditing) {
          return (
            <td key={col.id} data-col={col.id} className="px-4 py-2">
              {getColumnDisplay(col.id)}
            </td>
          )
        }

        return (
          <td
            key={col.id}
            data-col={col.id}
            className={cn(
              'px-4 py-2 text-sm',
              col.align === 'right' && 'text-right',
              col.align === 'center' && 'text-center',
              !inlineEditing && 'cursor-default'
            )}
          >
            {inlineEditing ? (
              // InlineEditOverlay is rendered at table level via portal,
              // so we just render the original display here during edit mode
              getColumnDisplay(col.id)
            ) : (
              getColumnDisplay(col.id)
            )}
          </td>
        )
      })}
    </tr>
  )
}
