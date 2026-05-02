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
import { arrayMove } from '@dnd-kit/sortable'
import { useRouter } from 'next/router'
import { useWorkPackages, useUpdateWorkPackage } from '@/hooks/use-work-packages'
import { WorkPackageBoardColumn } from './WorkPackageBoardColumn'
import { WorkPackageBoardDragLayer } from './WorkPackageBoardDragLayer'
import { WorkPackageBoardAddCard } from './WorkPackageBoardAddCard'
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
  const updateWorkPackage = useUpdateWorkPackage()

  const wpData = workPackages.data ?? []

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
      // WIP limits: placeholder — null = unlimited for all columns
      const wipLimit: number | null = null

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
      if (sourceStatusId === targetStatusId) return

      // Check WIP limit before dropping
      const targetColumn = columns.find((c) => c.statusId === targetStatusId)
      if (targetColumn?.wipLimit != null) {
        const wouldBeOver = targetColumn.workPackages.length >= targetColumn.wipLimit
        if (wouldBeOver) {
          // Block drop — show warning
          alert(`Cannot move: "${targetColumn.status.name}" is at its WIP limit (${targetColumn.wipLimit}).`)
          return
        }
      }

      // Optimistic update
      try {
        await updateWorkPackage.mutateAsync({
          id: active.id as string,
          data: { statusId: targetStatusId },
        })
      } catch {
        // TODO: show error toast
      }
    },
    [wpData, columns, updateWorkPackage]
  )

  // ── Render ────────────────────────────────────────────────────────────────────
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
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {columns.map((col) =>
            col.isOverLimit ? (
              <span key={col.statusId} className="text-red-500">
                ⚠️ {col.status.name} over limit
              </span>
            ) : null
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
                <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-3">
                    <rect x="4" y="12" width="40" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
                    <line x1="4" y1="20" x2="44" y2="20" stroke="currentColor" strokeWidth="2" />
                    <line x1="16" y1="4" x2="16" y2="42" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <p className="text-sm">No work packages to display.</p>
                </div>
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
