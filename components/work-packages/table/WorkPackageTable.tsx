import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Table, TableBody } from '@/components/ui'
import { WorkPackageTableHeader } from './WorkPackageTableHeader'
import { WorkPackageTableRow } from './WorkPackageTableRow'
import { WorkPackageFilters } from './WorkPackageFilters'
import { WorkPackageBulkActions } from './WorkPackageBulkActions'
import { WorkPackageInlineEdit, InlineEditSaveEvent } from './WorkPackageInlineEdit'
import { WorkPackageTableSkeleton } from './WorkPackageTableSkeleton'
import { WorkPackageTableEmptyState } from './WorkPackageTableEmptyState'
import type {
  Column,
  ColumnId,
  SortState,
  WorkPackageRow,
  FilterOptions,
} from './types'
import type { WorkPackageFilter } from '@/types'
import type { WorkPackage, Status, Type, Priority, User } from '@/types'
import { COLUMNS } from './types'
import {
  useWorkPackages,
  useUpdateWorkPackage,
  useDeleteWorkPackage,
} from '@/hooks/use-work-packages'

const ROW_HEIGHT = 48 // px — fixed height for virtualizer
const VIRTUAL_THRESHOLD = 100 // rows above which virtual scrolling activates

interface WorkPackageTableProps {
  /** Filter state passed from the parent (or from a saved query) */
  initialFilters?: Partial<WorkPackageFilter>
  /** Initial sort state */
  initialSort?: SortState | null
  /** Override projectId for the work package query */
  projectId?: string
}

export function WorkPackageTable({
  initialFilters = {},
  initialSort = null,
  projectId,
}: WorkPackageTableProps) {
  const router = useRouter()
  const queryProjectId = router.query.projectId as string | undefined
  const resolvedProjectId = projectId ?? queryProjectId

  // ── Filters & Sort state ──────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Partial<WorkPackageFilter>>(() => ({
    ...initialFilters,
    ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
  }))
  const [sort, setSort] = useState<SortState | null>(initialSort)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [allSelected, setAllSelected] = useState(false)

  // ── Inline editing state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ rowId: string; columnId: ColumnId } | null>(null)
  const [editingCellRect, setEditingCellRect] = useState<DOMRect | null>(null)

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  const { workPackages } = useWorkPackages(filters as WorkPackageFilter)
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
  // Build assignee list from current work packages
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

  // ── Client-side sort ──────────────────────────────────────────────────────────
  const sortedWorkPackages = useMemo(() => {
    const list = [...(workPackages.data ?? [])]
    if (!sort) return list
    return list.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort.columnId) {
        case 'subject':       av = a.subject; bv = b.subject; break
        case 'status':       av = a.status?.name ?? ''; bv = b.status?.name ?? ''; break
        case 'type':         av = a.type?.name ?? ''; bv = b.type?.name ?? ''; break
        case 'priority':     av = a.priority?.name ?? ''; bv = b.priority?.name ?? ''; break
        case 'assignee':     av = a.assignee?.name ?? ''; bv = b.assignee?.name ?? ''; break
        case 'startDate':    av = a.startDate ? new Date(a.startDate).getTime() : 0; bv = b.startDate ? new Date(b.startDate).getTime() : 0; break
        case 'dueDate':      av = a.dueDate ? new Date(a.dueDate).getTime() : 0; bv = b.dueDate ? new Date(b.dueDate).getTime() : 0; break
        case 'estimatedHours': av = a.estimatedHours ?? 0; bv = b.estimatedHours ?? 0; break
      }
      if (av < bv) return sort.direction === 'asc' ? -1 : 1
      if (av > bv) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [workPackages.data, sort])

  // Flatten hierarchy into rows with depth (Phase 2 spec: parent/child support)
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

  // ── Virtual scrolling ─────────────────────────────────────────────────────────
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
    : rows.map((r, i) => ({ index: i, start: i * ROW_HEIGHT, size: ROW_HEIGHT, end: (i + 1) * ROW_HEIGHT, key: r.workPackage.id }))

  // ── Selection ─────────────────────────────────────────────────────────────────
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(rows.map((r) => r.workPackage.id)))
      setAllSelected(true)
    } else {
      setSelectedIds(new Set())
      setAllSelected(false)
    }
  }, [rows])

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setAllSelected(false)
  }, [])

  // ── Sort ──────────────────────────────────────────────────────────────────────
  const handleSort = useCallback((columnId: ColumnId) => {
    setSort((prev) => {
      if (prev?.columnId === columnId) {
        return prev.direction === 'asc' ? { columnId, direction: 'desc' } : null
      }
      return { columnId, direction: 'asc' }
    })
  }, [])

  // ── Inline edit ──────────────────────────────────────────────────────────────
  const handleEditCell = useCallback(
    (rowId: string, columnId: ColumnId, rect: DOMRect | null) => {
      setEditingCellRect(rect)
      setEditing({ rowId, columnId })
    },
    []
  )
  const handleCancelEdit = useCallback(() => {
    setEditing(null)
    setEditingCellRect(null)
  }, [])

  const handleSaveEdit = useCallback(
    async (event: InlineEditSaveEvent): Promise<boolean> => {
      const { rowId, columnId, value } = event

      // Map columnId to the UpdateWorkPackageInput field
      const fieldMap: Record<ColumnId, string> = {
        subject: 'subject',
        status: 'statusId',
        type: 'typeId',
        priority: 'priorityId',
        assignee: 'assigneeId',
        startDate: 'startDate',
        dueDate: 'dueDate',
        estimatedHours: 'estimatedHours',
      }
      const field = fieldMap[columnId]
      if (!field) return true

      const updateData: Record<string, unknown> = { [field]: value }
      // Convert date string to ISO datetime for date fields
      if ((columnId === 'startDate' || columnId === 'dueDate') && value) {
        updateData[field] = new Date(value as string).toISOString()
      }
      // Convert estimatedHours string to number
      if (columnId === 'estimatedHours' && value !== null && value !== '') {
        updateData[field] = Number(value)
      }

      try {
        await updateWorkPackage.mutateAsync({ id: rowId, data: updateData as any })
        return true
      } catch {
        return false
      }
    },
    [updateWorkPackage]
  )

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteWorkPackage.mutateAsync(id)))
    },
    [deleteWorkPackage]
  )

  const handleBulkStatusChange = useCallback(
    async (ids: string[], statusId: string) => {
      await Promise.all(
        ids.map((id) =>
          updateWorkPackage.mutateAsync({ id, data: { statusId } })
        )
      )
    },
    [updateWorkPackage]
  )

  // ── Reset handlers ────────────────────────────────────────────────────────────
  const handleResetFilters = useCallback(() => {
    setFilters(resolvedProjectId ? { projectId: resolvedProjectId } : {})
    setSort(null)
  }, [resolvedProjectId])

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
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
        cellRect={editingCellRect}
        statuses={statuses}
        types={types}
        priorities={priorities}
        assignees={assignees}
      />,
      document.body
    )
  }, [editing, editingCellRect, rows, handleSaveEdit, handleCancelEdit, statuses, types, priorities, assignees])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <WorkPackageFilters
          filters={filters as WorkPackageFilter}
          onFiltersChange={setFilters as (f: WorkPackageFilter) => void}
          options={filterOptions}
          onReset={handleResetFilters}
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
            onClearFilters={handleResetFilters}
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
                sort={sort}
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
                      onEditCell={handleEditCell}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
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
          onClearSelection={() => { setSelectedIds(new Set()); setAllSelected(false) }}
          onBulkDelete={handleBulkDelete}
          onBulkStatusChange={handleBulkStatusChange}
          statuses={statuses}
        />,
        document.body
      )}

      {/* Inline edit overlay */}
      {inlineEditPortal}
    </div>
  )
}
