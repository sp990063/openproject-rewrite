// components/work-packages/table/hooks/useWorkPackageTableSelection.ts
// Row selection state for the work-package table.
//
// Selected ids live in the URL (via nuqs `sel` param) so the user can
// share a deep link to a pre-selected set. allSelected is local boolean
// state that reflects "all rows in the current view are selected" — it
// must reset whenever the underlying row set changes.
'use client'

import { useCallback, useMemo, useState } from 'react'
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs'
import type { WorkPackageRow } from '../types'

export interface UseWorkPackageTableSelectionResult {
  selectedIds: Set<string>
  allSelected: boolean
  handleSelect: (id: string, checked: boolean) => void
  handleSelectAll: (checked: boolean) => void
  clearSelection: () => void
}

export function useWorkPackageTableSelection(
  rows: readonly WorkPackageRow[],
): UseWorkPackageTableSelectionResult {
  const [selectedIdsRaw, setSelectedIdsRaw] = useQueryState(
    'sel',
    parseAsArrayOf(parseAsString).withDefault([]),
  )
  const [allSelected, setAllSelected] = useState(false)

  const selectedIds = useMemo(
    () => new Set(selectedIdsRaw),
    [selectedIdsRaw],
  )

  const handleSelect = useCallback(
    (id: string, checked: boolean) => {
      void setSelectedIdsRaw((prev) => {
        const next = new Set(prev)
        if (checked) next.add(id)
        else next.delete(id)
        return Array.from(next)
      })
      setAllSelected(false)
    },
    [setSelectedIdsRaw],
  )

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        void setSelectedIdsRaw(rows.map((r) => r.workPackage.id))
        setAllSelected(true)
      } else {
        void setSelectedIdsRaw([])
        setAllSelected(false)
      }
    },
    [rows, setSelectedIdsRaw],
  )

  const clearSelection = useCallback(() => {
    void setSelectedIdsRaw([])
    setAllSelected(false)
  }, [setSelectedIdsRaw])

  return { selectedIds, allSelected, handleSelect, handleSelectAll, clearSelection }
}
