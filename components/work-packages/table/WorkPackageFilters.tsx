import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button, Badge } from '@/components/ui'
import type { WorkPackageFilter } from '@/types'
import type { FilterOptions } from './types'

interface WorkPackageFiltersProps {
  filters: WorkPackageFilter
  onFiltersChange: (filters: WorkPackageFilter) => void
  options: FilterOptions
  onReset: () => void
  onSave?: () => void
  isSaving?: boolean
}

type ActiveFilterId = 'status' | 'type' | 'priority' | 'assignee' | 'startDate' | 'dueDate' | 'subject'

/** Map from filter id to human-readable label */
const FILTER_LABELS: Record<ActiveFilterId, string> = {
  status: 'Status',
  type: 'Type',
  priority: 'Priority',
  assignee: 'Assignee',
  startDate: 'Start Date',
  dueDate: 'Due Date',
  subject: 'Subject',
}

export function WorkPackageFilters({
  filters,
  onFiltersChange,
  options,
  onReset,
  onSave,
  isSaving,
}: WorkPackageFiltersProps) {
  const [openDropdown, setOpenDropdown] = useState<ActiveFilterId | null>(null)

  /** Toggle a single-value filter option (multi-select: toggle in/out of array) */
  const toggleArrayValue = useCallback(
    (field: 'statusId' | 'typeId' | 'priorityId' | 'assigneeId', value: string) => {
      const current = filters[field] ?? []
      const next = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value]
      onFiltersChange({ ...filters, [field]: next.length > 0 ? next : undefined })
    },
    [filters, onFiltersChange]
  )

  /** Count how many filters are active */
  const activeFilterCount = [
    filters.statusId?.length,
    filters.typeId?.length,
    filters.priorityId?.length,
    filters.assigneeId?.length,
    filters.startDate ? 1 : 0,
    filters.dueDate ? 1 : 0,
    filters.search ? 1 : 0,
  ].reduce<number>((acc, n) => acc + (n ?? 0), 0)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active filter pills */}
      {filters.statusId?.map((id: string) => (
        <FilterPill
          key={`status-${id}`}
          label={`Status: ${options.statuses.find((s) => s.id === id)?.name ?? id}`}
          onRemove={() => toggleArrayValue('statusId', id)}
        />
      ))}
      {filters.typeId?.map((id: string) => (
        <FilterPill
          key={`type-${id}`}
          label={`Type: ${options.types.find((t) => t.id === id)?.name ?? id}`}
          onRemove={() => toggleArrayValue('typeId', id)}
        />
      ))}
      {filters.priorityId?.map((id: string) => (
        <FilterPill
          key={`priority-${id}`}
          label={`Priority: ${options.priorities.find((p) => p.id === id)?.name ?? id}`}
          onRemove={() => toggleArrayValue('priorityId', id)}
        />
      ))}
      {filters.assigneeId?.map((id: string) => (
        <FilterPill
          key={`assignee-${id}`}
          label={`Assignee: ${options.assignees.find((u) => u.id === id)?.name ?? id}`}
          onRemove={() => toggleArrayValue('assigneeId', id)}
        />
      ))}
      {filters.startDate && (
        <FilterPill
          label={`Start: ${filters.startDate.gte ?? ''} – ${filters.startDate.lte ?? ''}`}
          onRemove={() => onFiltersChange({ ...filters, startDate: undefined })}
        />
      )}
      {filters.dueDate && (
        <FilterPill
          label={`Due: ${filters.dueDate.gte ?? ''} – ${filters.dueDate.lte ?? ''}`}
          onRemove={() => onFiltersChange({ ...filters, dueDate: undefined })}
        />
      )}
      {filters.search && (
        <FilterPill
          label={`Search: "${filters.search}"`}
          onRemove={() => onFiltersChange({ ...filters, search: undefined })}
        />
      )}

      {/* Dropdown filters */}
      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
        >
          Status {filters.statusId?.length ? `(${filters.statusId.length})` : ''}
        </Button>
        {openDropdown === 'status' && (
          <FilterDropdown
            options={options.statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
            selected={filters.statusId ?? []}
            onToggle={(v) => toggleArrayValue('statusId', v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </div>

      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
        >
          Type {filters.typeId?.length ? `(${filters.typeId.length})` : ''}
        </Button>
        {openDropdown === 'type' && (
          <FilterDropdown
            options={options.types.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
            selected={filters.typeId ?? []}
            onToggle={(v) => toggleArrayValue('typeId', v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </div>

      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
        >
          Priority {filters.priorityId?.length ? `(${filters.priorityId.length})` : ''}
        </Button>
        {openDropdown === 'priority' && (
          <FilterDropdown
            options={options.priorities.map((p) => ({ value: p.id, label: p.name, color: p.color }))}
            selected={filters.priorityId ?? []}
            onToggle={(v) => toggleArrayValue('priorityId', v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </div>

      <div className="relative">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
        >
          Assignee {filters.assigneeId?.length ? `(${filters.assigneeId.length})` : ''}
        </Button>
        {openDropdown === 'assignee' && (
          <FilterDropdown
            options={options.assignees.map((u) => ({ value: u.id, label: u.name }))}
            selected={filters.assigneeId ?? []}
            onToggle={(v) => toggleArrayValue('assigneeId', v)}
            onClose={() => setOpenDropdown(null)}
          />
        )}
      </div>

      {/* Date range filters */}
      <DateRangeFilter
        label="Start Date"
        value={filters.startDate}
        onChange={(v) => onFiltersChange({ ...filters, startDate: v })}
      />
      <DateRangeFilter
        label="Due Date"
        value={filters.dueDate}
        onChange={(v) => onFiltersChange({ ...filters, dueDate: v })}
      />

      {/* Text search */}
      <input
        type="text"
        placeholder="Search subject..."
        value={filters.search ?? ''}
        onChange={(e) =>
          onFiltersChange({ ...filters, search: e.target.value || undefined })
        }
        className="h-8 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
      />

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        {onSave && (
          <Button variant="primary" size="sm" onClick={onSave} isLoading={isSaving}>
            Save
          </Button>
        )}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset ({activeFilterCount})
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── FilterPill ────────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="info" className="gap-1 pl-2 pr-1 py-0.5">
      {label}
      <button
        onClick={onRemove}
        className="ml-1 text-current opacity-60 hover:opacity-100 cursor-pointer"
        aria-label={`Remove ${label} filter`}
      >
        ×
      </button>
    </Badge>
  )
}

// ─── FilterDropdown ────────────────────────────────────────────────────────────

interface FilterDropdownProps {
  options: { value: string; label: string; color?: string }[]
  selected: string[]
  onToggle: (value: string) => void
  onClose: () => void
}

function FilterDropdown({ options, selected, onToggle, onClose }: FilterDropdownProps) {
  return (
    <>
      {/* Backdrop to close dropdown */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg w-52 max-h-64 overflow-y-auto">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value)
          return (
            <label
              key={opt.value}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50',
                isSelected && 'bg-blue-50'
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={isSelected}
                onChange={() => onToggle(opt.value)}
              />
              {opt.color && (
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span className="truncate">{opt.label}</span>
            </label>
          )
        })}
      </div>
    </>
  )
}

// ─── DateRangeFilter ───────────────────────────────────────────────────────────

interface DateRangeFilterProps {
  label: string
  value?: { gte?: string; lte?: string }
  onChange: (value: { gte?: string; lte?: string } | undefined) => void
}

function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [localGte, setLocalGte] = useState(value?.gte ?? '')
  const [localLte, setLocalLte] = useState(value?.lte ?? '')

  const handleApply = () => {
    if (localGte || localLte) {
      onChange({ gte: localGte || undefined, lte: localLte || undefined })
    } else {
      onChange(undefined)
    }
    setOpen(false)
  }

  const isActive = !!value?.gte || !!value?.lte

  return (
    <div className="relative">
      <Button
        variant={isActive ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => setOpen((o) => !o)}
      >
        {label} {isActive ? '★' : ''}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={localGte}
                  onChange={(e) => setLocalGte(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={localLte}
                  onChange={(e) => setLocalLte(e.target.value)}
                  className="w-full h-8 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleApply} className="flex-1">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
