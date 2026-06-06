import React, { useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Badge, TableCell } from '@/components/ui'
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

/**
 * Per-column Zod schemas for inline cell editing.
 *
 * Each form's scope is a single `{ value: string }` field, so every schema
 * below is a one-key object. The validation rules mirror the table's existing
 * constraints (subject required, hours non-negative, etc.) and we intentionally
 * do NOT add new validation for columns that previously had none.
 */
const cellSchemas: Record<ColumnId, z.ZodType<{ value: string }>> = {
  subject: z.object({
    value: z
      .string()
      .min(1, 'Subject is required')
      .max(255, 'Subject must be 255 characters or fewer'),
  }),
  estimatedHours: z.object({
    value: z
      .string()
      .refine(
        (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0),
        'Estimated hours must be a non-negative number'
      ),
  }),
  startDate: z.object({
    value: z
      .string()
      .refine(
        (v) => v === '' || !Number.isNaN(Date.parse(v)),
        'Start date must be a valid date'
      ),
  }),
  dueDate: z.object({
    value: z
      .string()
      .refine(
        (v) => v === '' || !Number.isNaN(Date.parse(v)),
        'Due date must be a valid date'
      ),
  }),
  // Select columns had no validation in the original code; keep it that way.
  status: z.object({ value: z.string() }),
  type: z.object({ value: z.string() }),
  priority: z.object({ value: z.string() }),
  assignee: z.object({ value: z.string() }),
}

export function WorkPackageInlineEdit({
  rowId,
  columnId,
  currentValue,
  displayValue: _displayValue,
  onSave,
  onCancel,
  cellRect,
  statuses,
  types,
  priorities,
  assignees,
}: WorkPackageInlineEditProps) {
  // Per-cell form: exactly one field (`value`). Schema is selected by columnId.
  type CellValue = { value: string }
  const schema = cellSchemas[columnId] as z.ZodType<CellValue, CellValue>

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<CellValue>({
    resolver: zodResolver(schema),
    mode: 'onSubmit',
    defaultValues: {
      value: currentValue == null ? '' : String(currentValue),
    },
  })

  // The save state is intentionally NOT in formState (it's not validation).
  // We use a ref to avoid an extra render and to mirror the original lock
  // semantics.
  const isSavingRef = useRef(false)
  const [, forceTick] = React.useReducer((x: number) => x + 1, 0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const selectRef = useRef<HTMLSelectElement | null>(null)

  // Focus the input/select when the overlay opens. Using `register` returns a
  // ref we need to forward; we copy it into our local ref so we can still
  // imperatively focus/select.
  const inputReg = register('value')
  const selectReg = register('value')

  useEffect(() => {
    if (columnId === 'subject' || columnId === 'estimatedHours') {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      selectRef.current?.focus()
    }
    // The form is created fresh per-cell (component is unmounted when the
    // cell stops being edited), so this effect only runs once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Run the actual save. Pulls the current value from the form (not the event
   * payload) so both the Enter-to-save path and the auto-save-on-change path
   * go through the same code.
   */
  const performSave = async (rawValue: string) => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    forceTick()

    try {
      const event: InlineEditSaveEvent = {
        rowId,
        columnId,
        value: rawValue === '' ? null : rawValue,
      }
      const shouldClose = await onSave(event)
      if (shouldClose) {
        onCancel()
      }
    } finally {
      isSavingRef.current = false
      forceTick()
    }
  }

  // Wrap save in RHF's validation. If validation fails, RHF populates
  // `errors.value` and we just stop (no `onSave` call).
  const onValid = async (data: CellValue) => {
    await performSave(data.value)
  }
  const submit = handleSubmit(onValid)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  /**
   * Auto-save on select change. The original behaviour was to save the
   * selected id immediately (combobox-style). We mirror that here by
   * writing into the form and calling the save path.
   */
  const handleSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    next: string
  ) => {
    // Keep RHF state in sync (registers `value` and triggers re-render of
    // the watch subscription below if any).
    setValue('value', next, { shouldValidate: false, shouldDirty: true })
    void performSave(next)
    // Prevent the default RHF onChange below from re-firing save.
    e.preventDefault()
  }

  // The current value of the `value` field — used by selects to render
  // correctly when RHF and the underlying DOM need to agree.
  const value = watch('value')
  const errorMessage = errors.value?.message
  const isSaving = isSavingRef.current

  /** Render the appropriate input control for the column type */
  const renderInput = () => {
    switch (columnId) {
      case 'subject':
        return (
          <input
            ref={(el) => {
              inputRef.current = el
              inputReg.ref(el)
            }}
            type="text"
            value={value}
            onChange={inputReg.onChange}
            onBlur={inputReg.onBlur}
            name={inputReg.name}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-8 px-2 text-sm border border-blue-500 rounded',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'animate-pulse'
            )}
            disabled={isSaving}
            aria-invalid={errorMessage ? true : undefined}
          />
        )

      case 'estimatedHours':
        return (
          <input
            ref={(el) => {
              inputRef.current = el
              inputReg.ref(el)
            }}
            type="number"
            min="0"
            step="0.5"
            value={value}
            onChange={inputReg.onChange}
            onBlur={inputReg.onBlur}
            name={inputReg.name}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-8 px-2 text-sm border border-blue-500 rounded text-right',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'animate-pulse'
            )}
            disabled={isSaving}
            aria-invalid={errorMessage ? true : undefined}
          />
        )

      case 'status':
        return (
          <select
            ref={(el) => {
              selectRef.current = el
              selectReg.ref(el)
            }}
            value={value}
            name={selectReg.name}
            onChange={(e) => {
              // Override RHF's default change handler — we want to auto-save.
              handleSelectChange(e, e.target.value)
            }}
            onBlur={selectReg.onBlur}
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
            ref={(el) => {
              selectRef.current = el
              selectReg.ref(el)
            }}
            value={value}
            name={selectReg.name}
            onChange={(e) => {
              handleSelectChange(e, e.target.value)
            }}
            onBlur={selectReg.onBlur}
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
            ref={(el) => {
              selectRef.current = el
              selectReg.ref(el)
            }}
            value={value}
            name={selectReg.name}
            onChange={(e) => {
              handleSelectChange(e, e.target.value)
            }}
            onBlur={selectReg.onBlur}
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
            ref={(el) => {
              selectRef.current = el
              selectReg.ref(el)
            }}
            value={value}
            name={selectReg.name}
            onChange={(e) => {
              handleSelectChange(e, e.target.value)
            }}
            onBlur={selectReg.onBlur}
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
            ref={(el) => {
              inputRef.current = el
              inputReg.ref(el)
            }}
            type="date"
            value={value}
            onChange={inputReg.onChange}
            onBlur={inputReg.onBlur}
            name={inputReg.name}
            onKeyDown={handleKeyDown}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSaving}
            aria-invalid={errorMessage ? true : undefined}
          />
        )

      default:
        return (
          <input
            ref={(el) => {
              inputRef.current = el
              inputReg.ref(el)
            }}
            type="text"
            value={value}
            onChange={inputReg.onChange}
            onBlur={inputReg.onBlur}
            name={inputReg.name}
            onKeyDown={handleKeyDown}
            className="w-full h-8 px-2 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 animate-pulse"
            disabled={isSaving}
            aria-invalid={errorMessage ? true : undefined}
          />
        )
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
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
      {/*
        Inline validation error. Kept small and tucked under the input so it
        doesn't push the popover wider than the cell. `role="alert"` is fine
        for one-field-at-a-time editing.
      */}
      {errorMessage && (
        <p
          role="alert"
          className="mt-1 px-2 py-1 text-xs text-red-600 bg-red-50 border-t border-red-200 rounded-b"
        >
          {errorMessage}
        </p>
      )}
    </form>
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
    <TableCell
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
    </TableCell>
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
