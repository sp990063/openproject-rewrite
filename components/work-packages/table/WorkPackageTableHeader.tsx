import React from 'react'
import { cn } from '@/lib/utils'
import { TableHead } from '@/components/ui'
import type { Column, SortState, ColumnId } from './types'

interface WorkPackageTableHeaderProps {
  columns: Column[]
  sort: SortState | null
  onSort: (columnId: ColumnId) => void
  allSelected: boolean
  onSelectAll: (checked: boolean) => void
}

export function WorkPackageTableHeader({
  columns,
  sort,
  onSort,
  allSelected,
  onSelectAll,
}: WorkPackageTableHeaderProps) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
      <tr>
        {/* Checkbox column */}
        <TableHead className="w-10 px-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            aria-label="Select all work packages"
          />
        </TableHead>

        {columns.map((column) => (
          <TableHead
            key={column.id}
            className={cn(
              column.sortable && 'cursor-pointer select-none hover:bg-gray-100 transition-colors',
              column.align === 'right' && 'text-right',
              column.align === 'center' && 'text-center'
            )}
            style={{ width: column.width }}
            onClick={column.sortable ? () => onSort(column.id) : undefined}
            aria-sort={
              sort?.columnId === column.id
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            }
          >
            <span className="inline-flex items-center gap-1">
              {column.label}
              {column.sortable && (
                <SortIndicator columnId={column.id} sort={sort} />
              )}
            </span>
          </TableHead>
        ))}
      </tr>
    </thead>
  )
}

/** Renders the sort arrow icon for a column header */
function SortIndicator({
  columnId,
  sort,
}: {
  columnId: ColumnId
  sort: SortState | null
}) {
  const isActive = sort?.columnId === columnId

  return (
    <span className={cn('text-gray-300', isActive && 'text-blue-600')}>
      {isActive ? (
        sort.direction === 'asc' ? <SortAscIcon /> : <SortDescIcon />
      ) : (
        <SortNeutralIcon />
      )}
    </span>
  )
}

function SortNeutralIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1L9 4H3L6 1Z" fill="currentColor" opacity="0.4" />
      <path d="M6 11L3 8H9L6 11Z" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

function SortAscIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1L9 5H3L6 1Z" fill="currentColor" />
      <path d="M6 11L3 7H9L6 11Z" fill="currentColor" opacity="0" />
    </svg>
  )
}

function SortDescIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1L9 5H3L6 1Z" fill="currentColor" opacity="0" />
      <path d="M6 11L3 7H9L6 11Z" fill="currentColor" />
    </svg>
  )
}
