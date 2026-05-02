import type { WorkPackage, Status, Type, Priority, User } from '@/types'

/** Columns that can be displayed in the work package table */
export type ColumnId =
  | 'subject'
  | 'status'
  | 'type'
  | 'priority'
  | 'assignee'
  | 'startDate'
  | 'dueDate'
  | 'estimatedHours'

export interface Column {
  id: ColumnId
  label: string
  sortable: boolean
  width?: string // e.g. '200px', '15%'
  align?: 'left' | 'center' | 'right'
}

/** Available table columns — order is the default column order */
export const COLUMNS: Column[] = [
  { id: 'subject', label: 'Subject', sortable: true, width: 'minmax(200px, 1fr)' },
  { id: 'status', label: 'Status', sortable: true, width: '120px' },
  { id: 'type', label: 'Type', sortable: true, width: '100px' },
  { id: 'priority', label: 'Priority', sortable: true, width: '100px' },
  { id: 'assignee', label: 'Assignee', sortable: true, width: '140px' },
  { id: 'startDate', label: 'Start Date', sortable: true, width: '110px' },
  { id: 'dueDate', label: 'Due Date', sortable: true, width: '110px' },
  { id: 'estimatedHours', label: 'Est. Hours', sortable: true, width: '90px', align: 'right' },
]

/** Sort state for a single column */
export interface SortState {
  columnId: ColumnId
  direction: 'asc' | 'desc'
}

/** All client-side UI state for the work package table */
export interface WorkPackageTableState {
  /** Active sort column (only one at a time) */
  sort: SortState | null
  /** Which rows are selected (by work package id) */
  selectedIds: Set<string>
  /** Which column is currently being inline-edited (row id + column id) */
  editing: { rowId: string; columnId: ColumnId } | null
  /** Whether the select-all checkbox is checked */
  allSelected: boolean
}

/** Shape of a row rendered in the virtual table */
export interface WorkPackageRow {
  workPackage: WorkPackage
  depth: number // 0 = top-level, 1+ = child (indent level)
}

/** Lookup maps for filter dropdowns — hydrated from API */
export interface FilterOptions {
  statuses: Status[]
  types: Type[]
  priorities: Priority[]
  assignees: User[]
}
