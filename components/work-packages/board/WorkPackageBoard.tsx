import React, { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useRouter } from 'next/router'
import { useWorkPackages, useUpdateWorkPackage, useReorderWorkPackage } from '@/hooks/use-work-packages'
import { useWipLimits } from '@/hooks/use-wip-limits'
import { WorkPackageBoardColumn } from './WorkPackageBoardColumn'
import { WorkPackageBoardDragLayer } from './WorkPackageBoardDragLayer'
import { WorkPackageBoardAddCard } from './WorkPackageBoardAddCard'
import { WorkPackageBoardEmptyState } from './WorkPackageBoardEmptyState'
import type { BoardColumn } from './types'
import type { WorkPackageFilter } from '@/types'

interface WorkPackageBoardProps {
  initialFilters?: Partial<WorkPackageFilter>
  projectId?: string
}

export function WorkPackageBoard({ initialFilters = {}, projectId }: WorkPackageBoardProps) {
  const router = useRouter()
  const resolvedProjectId = projectId ?? (router.query.projectId as string | undefined)

  // ── DnD state ────────────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null)

  // ── Add card state ───────────────────────────────────────────────────────────
  const [addingToStatusId, setAddingToStatusId] = useState<string | null>(null)

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filters] = useState<Partial<WorkPackageFilter>>(() => ({
    ...initialFilters,
    ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
  }))

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { workPackages } = useWorkPackages(filters as WorkPackageFilter)
  const { data: wipLimits = [] } = useWipLimits(resolvedProjectId ?? '')
  const updateWorkPackage = useUpdateWorkPackage()
  const reorderWorkPackage = useReorderWorkPackage()

  const wpData = workPackages.data ?? []

  // ── Build WIP limit map: statusId → limit ───────────────────────────────────
  const wipLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    for (const l of wipLimits) map.set(l.statusId, l.limit)
    return map
  }, [wipLimits])

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating drag
      },
    })
  )

  // ── Group work packages by status ─────────────────────────────────────────────
  // TODO: Fetch real WIP limits from API (p2-022 will add the API endpoint)
  // For now, wipLimit = null means unlimited
  const columns: BoardColumn[] = useMemo(() => {
    const groups = new Map<string, import('@/types').WorkPackage[]>()

    for (const wp of wpData) {
      const statusId = wp.statusId ?? 'none'
      if (!groups.has(statusId)) groups.set(statusId, [])
      groups.get(statusId)!.push(wp)
    }

    // Build columns in the order of status.position
    const result: BoardColumn[] = []
    for (const [statusId, wps] of groups) {
      const firstWp = wps[0]
      const status = firstWp.status ?? { id: statusId, name: 'Unknown', color: '#6B7280', position: 0, isClosed: false }
      const wipLimit = wipLimitMap.get(statusId) ?? null

      result.push({
        statusId,
        status,
        workPackages: wps,
        wipLimit,
        isOverLimit: wipLimit !== null && wps.length > wipLimit,
        isAtLimit: wipLimit !== null && wps.length === wipLimit,
      })
    }

    // Sort by status.position
    result.sort((a, b) => (a.status.position ?? 0) - (b.status.position ?? 0))

    return result
  }, [wpData])

  // ── DnD handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      // Determine target statusId
      const overData = over.data.current as { type?: string; statusId?: string } | undefined
      const targetStatusId = overData?.statusId ?? (over.id as string)

      // Find the work package being dragged
      const draggedWp = wpData.find((wp) => wp.id === active.id)
      if (!draggedWp) return

      const sourceStatusId = draggedWp.statusId ?? 'none'
      const isSameColumn = sourceStatusId === targetStatusId

      // Get target column (for WIP check or position calculation)
      const targetColumn = columns.find((c) => c.statusId === targetStatusId)
      const newPosition = isSameColumn
        ? draggedWp.position
        : (targetColumn?.workPackages.length ?? 0)

      // Check WIP limit before dropping (only for cross-column moves)
      if (!isSameColumn && targetColumn?.wipLimit != null) {
        const wouldBeOver = targetColumn.workPackages.length >= targetColumn.wipLimit
        if (wouldBeOver) {
          alert(`Cannot move: "${targetColumn.status.name}" is at its WIP limit (${targetColumn.wipLimit}).`)
          return
        }
      }

      try {
        // 1. Update statusId (cross-column) or keep same (same-column reorder)
        await updateWorkPackage.mutateAsync({
          id: active.id as string,
          data: { statusId: targetStatusId },
        })

        // 2. Persist position via reorder endpoint
        if (newPosition !== draggedWp.position) {
          await reorderWorkPackage.mutateAsync({
            workPackageId: active.id as string,
            position: newPosition,
          })
        }
      } catch {
        // TODO: show error toast
      }
    },
    [wpData, columns, updateWorkPackage, reorderWorkPackage]
  )

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">Board</h2>
          <span className="text-sm text-gray-500">
            {wpData.length} work package{wpData.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {columns.map((col) =>
              col.isOverLimit ? (
                <span key={col.statusId} className="text-red-500">
                  ⚠️ {col.status.name} over limit
                </span>
              ) : null
            )}
          </div>
          {resolvedProjectId && (
            <button
              onClick={() => {
                const statusId = prompt('Enter status ID to set WIP limit:')
                if (!statusId) return
                const limitStr = prompt('Enter WIP limit (empty = unlimited):')
                const limit = limitStr === '' ? null : parseInt(limitStr, 10)
                if (isNaN(limit) && limitStr !== '') return
                import('@/hooks/use-wip-limits').then(({ useUpdateWipLimit }) => {
                  // Use a refetch approach — for now, just reload the page
                  window.location.reload()
                })
              }}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              Configure WIP Limits
            </button>
          )}
        </div>
      </div>

      {/* Board body */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {workPackages.isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
        ) : workPackages.isError ? (
          <div className="flex items-center justify-center h-64 text-red-500">Failed to load work packages.</div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 p-4 h-full items-start">
              {columns.map((column) => (
                <WorkPackageBoardColumn
                  key={column.statusId}
                  column={column}
                  onAddCard={(statusId) => setAddingToStatusId(statusId)}
                />
              ))}

              {columns.length === 0 && (
                <WorkPackageBoardEmptyState />
              )}
            </div>

            <WorkPackageBoardDragLayer activeId={activeId} workPackages={wpData} />
          </DndContext>
        )}
      </div>

      {/* Inline add card overlay */}
      {addingToStatusId && resolvedProjectId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-80">
          <WorkPackageBoardAddCard
            statusId={addingToStatusId}
            projectId={resolvedProjectId}
            onClose={() => setAddingToStatusId(null)}
          />
        </div>
      )}
    </div>
  )
}
