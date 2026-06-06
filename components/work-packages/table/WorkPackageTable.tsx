import React, { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Table, TableBody } from '@/components/ui'
import { WorkPackageTableHeader } from './WorkPackageTableHeader'
import { WorkPackageTableRow } from './WorkPackageTableRow'
import { WorkPackageFilters } from './WorkPackageFilters'
import { WorkPackageBulkActions } from './WorkPackageBulkActions'
import { WorkPackageInlineEdit } from './WorkPackageInlineEdit'
import { WorkPackageTableSkeleton } from './WorkPackageTableSkeleton'
import { WorkPackageTableEmptyState } from './WorkPackageTableEmptyState'
import type {
  Column,
  ColumnId,
  WorkPackageRow,
  FilterOptions,
} from './types'
import type { WorkPackageFilter } from '@/types'
import type { WorkPackage, Status, Type, Priority, User } from '@/types'
import { COLUMNS } from './types'
import {
  useWorkPackages,
  useDeleteWorkPackage,
  useUpdateWorkPackage,
} from '@/hooks/use-work-packages'
import { useWorkPackageTableSort } from './hooks/useWorkPackageTableSort'
import { useWorkPackageTableSelection } from './hooks/useWorkPackageTableSelection'
import { useWorkPackageInlineEdit } from './hooks/useWorkPackageInlineEdit'
import { useWorkPackageTableFilters } from './hooks/useWorkPackageTableFilters'

const ROW_HEIGHT = 48 // px — fixed height for virtualizer
const VIRTUAL_THRESHOLD = 100 // rows above which virtual scrolling activates

interface WorkPackageTableProps {
  /** Filter state passed from the parent (or from a saved query) */
  initialFilters?: Partial<WorkPackageFilter>
  /** Initial sort state */
  initialSort?: import('./types').SortState | null
  /** Override projectId for the work package query */
  projectId?: string
  /** Called whenever the user changes filters inside the table */
  onFiltersChange?: (filters: WorkPackageFilter) => void
  /** Called when the user clicks the Save button in the filter bar */
  onSave?: () => void
  /** Whether a save operation is in progress */
  isSaving?: boolean
}

export function WorkPackageTable({
  initialFilters = {},
  initialSort: _initialSort = null,
  projectId,
  onFiltersChange,
  onSave,
  isSaving,
}: WorkPackageTableProps) {
  const router = useRouter()
  const queryProjectId = router.query.projectId as string | undefined
  const resolvedProjectId = projectId ?? queryProjectId

  // ── Composed hooks ────────────────────────────────────────────────────────────
  // All state + handlers for filters, sort, selection, and inline editing
  // are now encapsulated in dedicated hooks under ./hooks. This file is
  // a pure composition layer + render shell.
  const { filters, setFilters, resetFilters } = useWorkPackageTableFilters({
    initialFilters,
    resolvedProjectId,
    onFiltersChange,
  })
  const { sortState, setSort } = useWorkPackageTableSort()

  // Rows are derived from filters; selection hook needs the final row list.
  const { workPackages } = useWorkPackages(filters as WorkPackageFilter)
  const sortedWorkPackages = useMemo(() => {
    const list = [...(workPackages.data ?? [])]
    if (!sortState) return list
    return list.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortState.columnId) {
        case 'subject':       av = a.subject; bv = b.subject; break
        case 'status':       av = a.status?.name ?? ''; bv = b.status?.name ?? ''; break
        case 'type':         av = a.type?.name ?? ''; bv = b.type?.name ?? ''; break
        case 'priority':     av = a.priority?.name ?? ''; bv = b.priority?.name ?? ''; break
        case 'assignee':     av = a.assignee?.name ?? ''; bv = b.assignee?.name ?? ''; break
        case 'startDate':    av = a.startDate ? new Date(a.startDate).getTime() : 0; bv = b.startDate ? new Date(b.startDate).getTime() : 0; break
        case 'dueDate':      av = a.dueDate ? new Date(a.dueDate).getTime() : 0; bv = b.dueDate ? new Date(b.dueDate).getTime() : 0; break
        case 'estimatedHours': av = a.estimatedHours ?? 0; bv = b.estimatedHours ?? 0; break
      }
      if (av < bv) return sortState.direction === 'asc' ? -1 : 1
      if (av > bv) return sortState.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [workPackages.data, sortState])

  const rows: WorkPackageRow[] = useMemo(() => {
    const map = new Map<string | null, WorkPackage[]>()
    const roots: WorkPackage[] = []
    for (const wp of sortedWorkPackages) {
      const arr = map.get(wp.parentId ?? null) ?? []
      arr.push(wp)
      map.set(wp.parentId ?? null, arr)
    }
    function flatten(wps: WorkPackage[], depth: number): WorkPackageRow[] {
      return wps.flatMap((wp) => [
        { workPackage: wp, depth },
        ...flatten(map.get(wp.id) ?? [], depth + 1),
      ])
    }
    return flatten(map.get(null) ?? roots, 0)
  }, [sortedWorkPackages])

  const selection = useWorkPackageTableSelection(rows)
  const {
    selectedIds,
    allSelected,
    handleSelect,
    handleSelectAll,
    clearSelection,
  } = selection

  const inlineEdit = useWorkPackageInlineEdit()
  const {
    editing,
    editingCellRect,
    openEdit,
    cancelEdit,
    saveEdit,
  } = inlineEdit

  const updateWorkPackage = useUpdateWorkPackage()
  const deleteWorkPackage = useDeleteWorkPackage()

  // ── Filter lookup options (fetched from API) ──────────────────────────────────
  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ['statuses'],
    queryFn: async () => {
      const r = await fetch('/api/statuses')
      if (!r.ok) throw new Error('Failed to fetch statuses')
      return r.json()
    },
  })
  const { data: types = [] } = useQuery<Type[]>({
    queryKey: ['types'],
    queryFn: async () => {
      const r = await fetch('/api/types')
      if (!r.ok) throw new Error('Failed to fetch types')
      return r.json()
    },
  })
  const { data: priorities = [] } = useQuery<Priority[]>({
    queryKey: ['priorities'],
    queryFn: async () => {
      const r = await fetch('/api/priorities')
      if (!r.ok) throw new Error('Failed to fetch priorities')
      return r.json()
    },
  })
  const assignees = useMemo(() => {
    const seen = new Set<string>()
    const result: User[] = []
    for (const wp of workPackages.data ?? []) {
      if (wp.assignee && !seen.has(wp.assignee.id)) {
        seen.add(wp.assignee.id)
        result.push(wp.assignee)
      }
    }
    return result
  }, [workPackages.data])

  const filterOptions: FilterOptions = { statuses, types, priorities, assignees }

  // ── Virtual scrolling ─────────────────────────────────────────────────────────
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const useVirtual = rows.length > VIRTUAL_THRESHOLD
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  })
  const virtualItems = useVirtual
    ? virtualizer.getVirtualItems()
    : rows.map((r, i) => ({
        index: i,
        start: i * ROW_HEIGHT,
        size: ROW_HEIGHT,
        end: (i + 1) * ROW_HEIGHT,
        key: r.workPackage.id,
      }))

  // ── Sort click ──────────────────────────────────────────────────────────────
  const handleSort = useCallback(
    (columnId: ColumnId) => {
      setSort((prev) => {
        if (prev?.columnId === columnId) {
          return prev.direction === 'asc' ? { columnId, direction: 'desc' } : null
        }
        return { columnId, direction: 'asc' }
      })
    },
    [setSort],
  )

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteWorkPackage.mutateAsync(id)))
    },
    [deleteWorkPackage],
  )
  const handleBulkStatusChange = useCallback(
    async (ids: string[], statusId: string) => {
      await Promise.all(
        ids.map((id) =>
          updateWorkPackage.mutateAsync({ id, data: { statusId } }),
        ),
      )
    },
    [updateWorkPackage],
  )

  // ── Inline edit portal ──────────────────────────────────────────────────────
  const inlineEditPortal = useMemo(() => {
    if (!editing || !editingCellRect) return null
    const row = rows.find((r) => r.workPackage.id === editing.rowId)
    const wp = row?.workPackage
    if (!wp) return null

    const currentValue = (() => {
      switch (editing.columnId) {
        case 'subject': return wp.subject
        case 'status': return wp.statusId
        case 'type': return wp.typeId
        case 'priority': return wp.priorityId
        case 'assignee': return wp.assigneeId
        case 'startDate': return wp.startDate ? new Date(wp.startDate).toISOString().split('T')[0] : ''
        case 'dueDate': return wp.dueDate ? new Date(wp.dueDate).toISOString().split('T')[0] : ''
        case 'estimatedHours': return wp.estimatedHours ?? ''
        default: return ''
      }
    })()

    const displayValue = (() => {
      switch (editing.columnId) {
        case 'status': return wp.status?.name
        case 'type': return wp.type?.name
        case 'priority': return wp.priority?.name
        case 'assignee': return wp.assignee?.name
        default: return currentValue
      }
    })()

    return createPortal(
      <WorkPackageInlineEdit
        rowId={wp.id}
        columnId={editing.columnId}
        currentValue={currentValue}
        displayValue={displayValue}
        onSave={saveEdit}
        onCancel={cancelEdit}
        cellRect={editingCellRect}
        statuses={statuses}
        types={types}
        priorities={priorities}
        assignees={assignees}
      />,
      document.body,
    )
  }, [editing, editingCellRect, rows, saveEdit, cancelEdit, statuses, types, priorities, assignees])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <WorkPackageFilters
          filters={filters as WorkPackageFilter}
          onFiltersChange={setFilters as (f: WorkPackageFilter) => void}
          options={filterOptions}
          onReset={() => {
            resetFilters()
            setSort(null)
          }}
          onSave={onSave}
          isSaving={isSaving}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        {workPackages.isLoading ? (
          <WorkPackageTableSkeleton />
        ) : workPackages.isError ? (
          <div className="flex items-center justify-center h-48 text-red-600">
            Failed to load work packages.
          </div>
        ) : rows.length === 0 ? (
          <WorkPackageTableEmptyState
            onClearFilters={resetFilters}
            hasFilters={Object.keys(filters).length > 0}
          />
        ) : (
          <div ref={tableContainerRef} className="h-full overflow-auto">
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: '40px' }} />
                {COLUMNS.map((col) => (
                  <col key={col.id} style={{ width: col.width }} />
                ))}
              </colgroup>

              <WorkPackageTableHeader
                columns={COLUMNS}
                sort={sortState}
                onSort={handleSort}
                allSelected={allSelected}
                onSelectAll={handleSelectAll}
              />

              <TableBody>
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  return (
                    <WorkPackageTableRow
                      key={row.workPackage.id}
                      row={row}
                      columns={COLUMNS}
                      isSelected={selectedIds.has(row.workPackage.id)}
                      editing={editing}
                      onSelect={handleSelect}
                      onEditCell={openEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      editingCellRect={editingCellRect}
                      statuses={statuses}
                      types={types}
                      priorities={priorities}
                      assignees={assignees}
                    />
                  )
                })}
              </TableBody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && createPortal(
        <WorkPackageBulkActions
          selectedIds={selectedIds}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
          statuses={statuses}
        />,
        document.body,
      )}

      {/* Inline edit overlay */}
      {inlineEditPortal}
    </div>
  )
}
