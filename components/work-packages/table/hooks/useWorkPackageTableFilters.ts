// components/work-packages/table/hooks/useWorkPackageTableFilters.ts
// Filter state for the work-package table.
//
// Filters remain in local useState (per-table instance) because they
// are a nested object the Filter UI mutates incrementally and the
// parent page already handles URL sync at the ?queryId= level. A
// `reset()` helper takes the resolved project id so the project-scope
// filter is preserved across resets.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkPackageFilter } from '@/types'

export interface UseWorkPackageTableFiltersOptions {
  initialFilters?: Partial<WorkPackageFilter>
  resolvedProjectId: string | undefined
  /** Notify the parent whenever the user changes filters. */
  onFiltersChange?: (filters: WorkPackageFilter) => void
}

export interface UseWorkPackageTableFiltersResult {
  filters: Partial<WorkPackageFilter>
  setFilters: React.Dispatch<React.SetStateAction<Partial<WorkPackageFilter>>>
  resetFilters: () => void
}

export function useWorkPackageTableFilters(
  options: UseWorkPackageTableFiltersOptions,
): UseWorkPackageTableFiltersResult {
  const { initialFilters = {}, resolvedProjectId, onFiltersChange } = options

  const [filters, setFilters] = useState<Partial<WorkPackageFilter>>(() => ({
    ...initialFilters,
    ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
  }))

  // Avoid notifying the parent on the initial mount.
  const initRef = useRef(false)
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true
      return
    }
    onFiltersChange?.(filters as WorkPackageFilter)
  }, [filters, onFiltersChange])

  const resetFilters = useCallback(() => {
    setFilters(resolvedProjectId ? { projectId: resolvedProjectId } : {})
  }, [resolvedProjectId])

  return { filters, setFilters, resetFilters }
}
