// components/work-packages/table/hooks/useWorkPackageTableSort.ts
// Sort state for the work-package table.
//
// Sort lives in the URL (via nuqs) so the sort survives page reloads and
// is shareable as a deep link. This hook hides the two `useQueryState`
// calls and the `setSort` callback that fuses them into a single
// `SortState | null` value matching the table's API.
'use client'

import { useCallback, useMemo } from 'react'
import {
  parseAsStringLiteral,
  useQueryState,
} from 'nuqs'
import type { ColumnId, SortState } from '../types'

const SORT_COLUMNS = [
  'subject',
  'status',
  'type',
  'priority',
  'assignee',
  'startDate',
  'dueDate',
  'estimatedHours',
  'createdAt',
] as const

type SortColumnLiteral = (typeof SORT_COLUMNS)[number]

function isSortColumn(v: string | null): v is SortColumnLiteral {
  return v !== null && (SORT_COLUMNS as readonly string[]).includes(v)
}

export interface UseWorkPackageTableSortResult {
  sortState: SortState | null
  setSort: (
    next:
      | SortState
      | null
      | ((prev: SortState | null) => SortState | null),
  ) => void
}

export function useWorkPackageTableSort(): UseWorkPackageTableSortResult {
  const [sortCol, setSortCol] = useQueryState(
    'sortCol',
    parseAsStringLiteral(SORT_COLUMNS).withDefault('createdAt'),
  )
  const [sortDir, setSortDir] = useQueryState(
    'sortDir',
    parseAsStringLiteral(['asc', 'desc']).withDefault('desc'),
  )

  // sortCol is typed as a literal union by nuqs; the cast is a type
  // assertion that matches the existing column-id type system.
  const sortState: SortState | null = useMemo(() => {
    if (!isSortColumn(sortCol)) return null
    return { columnId: sortCol as ColumnId, direction: sortDir ?? 'desc' }
  }, [sortCol, sortDir])

  const setSort = useCallback(
    (
      next:
        | SortState
        | null
        | ((prev: SortState | null) => SortState | null),
    ) => {
      const resolved =
        typeof next === 'function' ? next(sortState) : next
      if (!resolved) {
        void setSortCol(null)
        void setSortDir(null)
        return
      }
      void setSortCol(resolved.columnId as unknown as SortColumnLiteral)
      void setSortDir(resolved.direction)
    },
    [sortState, setSortCol, setSortDir],
  )

  return { sortState, setSort }
}
