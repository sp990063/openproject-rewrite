import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'
import type { Status, Type, Priority, User } from '@/types'
import type { ColumnId } from './types'

/** Payload when an inline edit is saved */
export interface InlineEditSaveEvent {
  rowId: string
  columnId: ColumnId
  value: string | number | null
}

/** Props for the inline edit overlay */
interface WorkPackageInlineEditProps {
  rowId: string
  columnId: ColumnId
  currentValue: unknown
  /** Display value shown when not editing */
  displayValue: React.ReactNode
  /** Called when the user saves; return true to close, false to keep open */
  onSave: (event: InlineEditSaveEvent) => Promise<boolean>
  onCancel: () => void
  /** Editing cell bounds (for absolute positioning) */
  cellRect: DOMRect | null
  /** Status options (for status column) */
  statuses?: Status[]
  /** Type options (for type column) */
  types?: Type[]
  /** Priority options (for priority column) */
  priorities?: Priority[]
  /** Assignee options (for assignee column) */
  assignees?: User[]
}

export function WorkPackageInlineEdit({
  rowId,
  columnId,
  currentValue,
  displayValue,
  onSave,
  onCancel,
  cellRect,
  statuses,
  types,
  priorities,
  assignees,
}: WorkPackageInlineEditProps) {
  const [localValue, setLocalValue] = useState<string>(String(currentValue ?? ''))
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  // Lock ref — prevents double-save if user double-clicks or network is slow.
  // Set to true when save starts, false when it completes.
  const editLockRef = useRef(false)

  useEffect(() => {
    // Focus the input/select when the overlay opens
    if (columnId === 'subject' || columnId === 'estimatedHours') {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      selectRef.current?.focus()
    }
  }, [columnId])

  const handleSave = async () => {
    // Prevent double-submission
    if (editLockRef.current || isSaving) return
    editLockRef.current = true
    setIsSaving(true)

    try {
      const event: InlineEditSaveEvent = {
        rowId,
        columnId,
        value: localValue || null,
      }
      const shouldClose = await onSave(event)
      if (shouldClose) {
        onCancel()
      }
    } finally {
      editLockRef.current = false
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  /** Render the appropriate input control for the column type */
  const renderInput = () => {
    switch (columnId) {
      case 'subject':
        return (
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-8 px-2 text-sm border border-blue-500 rounded',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'animate-pulse'
            )}
            disabled={isSaving}
          />
        )

      case 'estimatedHours':
        return (
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.5"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-8 px-2 text-sm border border-blue-500 rounded text-right',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'animate-pulse'
            )}
            disabled={isSaving}
          />
        )

      case 'status':
        return (
          <select
            ref={selectRef}
            value={String(currentValue ?? '')}
            onChange={(e) => {
              setLocalValue(e.target.value)
              // Auto-save on select change (like a combobox)
              void (async () => {
                if (editLockRef.current) return
                editLockRef.current = true
                setIsSaving(true)
                try {
                  const ok = await onSave({ rowId, columnId, value: e.target.value || null })
                  if (ok) onCancel()
                } finally {
                  editLockRef.current = false
                  setIsSaving(false)
                }
              })()
            }}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={isSaving}
          >
            <option value="">—</option>
            {statuses?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )

      case 'type':
        return (
          <select
            ref={selectRef}
            value={String(currentValue ?? '')}
            onChange={(e) => {
              setLocalValue(e.target.value)
              void (async () => {
                if (editLockRef.current) return
                editLockRef.current = true
                setIsSaving(true)
                try {
                  const ok = await onSave({ rowId, columnId, value: e.target.value || null })
                  if (ok) onCancel()
                } finally {
                  editLockRef.current = false
                  setIsSaving(false)
                }
              })()
            }}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={isSaving}
          >
            <option value="">—</option>
            {types?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )

      case 'priority':
        return (
          <select
            ref={selectRef}
            value={String(currentValue ?? '')}
            onChange={(e) => {
              setLocalValue(e.target.value)
              void (async () => {
                if (editLockRef.current) return
                editLockRef.current = true
                setIsSaving(true)
                try {
                  const ok = await onSave({ rowId, columnId, value: e.target.value || null })
                  if (ok) onCancel()
                } finally {
                  editLockRef.current = false
                  setIsSaving(false)
                }
              })()
            }}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={isSaving}
          >
            <option value="">—</option>
            {priorities?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )

      case 'assignee':
        return (
          <select
            ref={selectRef}
            value={String(currentValue ?? '')}
            onChange={(e) => {
              setLocalValue(e.target.value)
              void (async () => {
                if (editLockRef.current) return
                editLockRef.current = true
                setIsSaving(true)
                try {
                  const ok = await onSave({ rowId, columnId, value: e.target.value || null })
                  if (ok) onCancel()
                } finally {
                  editLockRef.current = false
                  setIsSaving(false)
                }
              })()
            }}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            disabled={isSaving}
          >
            <option value="">Unassigned</option>
            {assignees?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )

      case 'startDate':
      case 'dueDate':
        return (
          <input
            ref={inputRef}
            type="date"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving}
          />
        )

      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 animate-pulse"
            disabled={isSaving}
          />
        )
    }
  }

  return (
    <div
      className={cn(
        'absolute z-50 bg-white border border-blue-500 rounded shadow-lg',
        'animate-pulse'
      )}
      style={
        cellRect
          ? {
              top: cellRect.bottom + window.scrollY + 2,
              left: cellRect.left + window.scrollX,
              minWidth: Math.max(cellRect.width, 120),
            }
          : {}
      }
      onKeyDown={handleKeyDown}
    >
      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute -top-5 left-0 text-xs text-blue-600 bg-blue-50 px-1 rounded-t">
          Saving...
        </div>
      )}
      {renderInput()}
    </div>
  )
}

/** Read-only display for a table cell (the default when not editing) */
export function InlineCellDisplay({
  children,
  isSelected,
  onDoubleClick,
  className,
  align,
}: {
  children: React.ReactNode
  isSelected?: boolean
  onDoubleClick?: () => void
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  return (
    <td
      className={cn(
        'px-4 py-2 text-sm text-gray-900 cursor-default',
        'hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      onDoubleClick={onDoubleClick}
      title="Double-click to edit"
    >
      {children}
    </td>
  )
}

/** Read-only display for status badge cell */
export function StatusBadgeDisplay({
  status,
  isSelected,
  onDoubleClick,
}: {
  status: Status
  isSelected?: boolean
  onDoubleClick?: () => void
}) {
  return (
    <InlineCellDisplay isSelected={isSelected} onDoubleClick={onDoubleClick}>
      <Badge
        variant={status.isClosed ? 'default' : 'info'}
        style={{
          backgroundColor: (status.color ?? '#666') + '20',
          color: status.color ?? '#666',
        }}
      >
        {status.name}
      </Badge>
    </InlineCellDisplay>
  )
}
