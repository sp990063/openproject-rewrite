import React, { useState, useMemo, useRef, useCallback } from 'react'
import { addDays, differenceInDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import {
  calculateTimelineBounds,
  calculateGanttLayout,
  calculateRowIndices,
  getDayWidth,
  zoomIn,
  zoomOut,
  type GanttWorkPackage,
  type GanttDependency,
} from './types'
import type { GanttZoomLevel } from '@/lib/gantt/calculate'
import { GanttTimeline } from './GanttTimeline'
import { GanttRows } from './GanttRows'
import { GanttBar } from './GanttBar'
import { GanttDependencyLines } from './GanttDependencyLines'
import { GanttTodayLine } from './GanttTodayLine'
import { GanttZoomControls } from './GanttZoomControls'
import { useWorkPackages, useUpdateWorkPackage } from '@/hooks/use-work-packages'
import type { WorkPackageFilter } from '@/types'

const ROW_HEIGHT = 48

interface GanttChartProps {
  initialFilters?: Partial<WorkPackageFilter>
  projectId?: string
}

export function GanttChart({ initialFilters = {}, projectId }: GanttChartProps) {
  const router = useRouter()
  const resolvedProjectId = projectId ?? (router.query.projectId as string | undefined)

  // ── Zoom + Scroll state ──────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState<GanttZoomLevel>('month')
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Partial<WorkPackageFilter>>(() => ({
    ...initialFilters,
    ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
  }))

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { workPackages } = useWorkPackages(filters as WorkPackageFilter)
  const updateWorkPackage = useUpdateWorkPackage()

  const wpData = workPackages.data ?? []

  // ── Layout calculation ───────────────────────────────────────────────────────
  const bounds = useMemo(
    () => calculateTimelineBounds(wpData, zoomLevel),
    [wpData, zoomLevel]
  )

  const dayWidth = getDayWidth(zoomLevel)

  const ganttItems = useMemo(
    () => calculateGanttLayout(wpData, { zoomLevel, viewportStart: bounds.viewportStart }),
    [wpData, zoomLevel, bounds.viewportStart]
  )

  const rowMap = useMemo(() => calculateRowIndices(ganttItems, ROW_HEIGHT), [ganttItems])

  // Build a Map for quick lookups
  const workPackagesMap = useMemo(
    () => new Map(ganttItems.map((item) => [item.id, item])),
    [ganttItems]
  )

  const totalHeight = (rowMap.size > 0 ? Math.max(...Array.from(rowMap.values())) + 1 : 1) * ROW_HEIGHT
  const totalWidth = bounds.totalDays * dayWidth

  // ── Dependencies (placeholder — fetched from API) ───────────────────────────
  // TODO: p2-018 — wire up useWorkPackageRelations
  const dependencies: GanttDependency[] = []

  // ── Selection ────────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleRowClick = useCallback(
    (id: string) => {
      if (resolvedProjectId) {
        void router.push(`/projects/${resolvedProjectId}/work-packages/${id}`)
      }
    },
    [router, resolvedProjectId]
  )

  // ── Date resize ───────────────────────────────────────────────────────────────
  const handleDatesChange = useCallback(
    async (id: string, startDate: string | null, dueDate: string | null) => {
      const data: Record<string, string | null> = {}
      if (startDate !== null) data.startDate = startDate
      if (dueDate !== null) data.dueDate = dueDate
      try {
        await updateWorkPackage.mutateAsync({ id, data: data as any })
      } catch {
        // TODO: show error toast
      }
    },
    [updateWorkPackage]
  )

  // ── Sync scroll between timeline and rows ────────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft((e.target as HTMLDivElement).scrollLeft)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">Gantt Chart</h2>
          <span className="text-sm text-gray-500">
            {wpData.length} work package{wpData.length !== 1 ? 's' : ''}
          </span>
        </div>
        <GanttZoomControls
          zoomLevel={zoomLevel}
          onZoomIn={() => setZoomLevel((z) => zoomIn(z))}
          onZoomOut={() => setZoomLevel((z) => zoomOut(z))}
        />
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-hidden">
        {workPackages.isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
        ) : workPackages.isError ? (
          <div className="flex items-center justify-center h-64 text-red-500">Failed to load work packages.</div>
        ) : ganttItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-3">
              <rect x="4" y="12" width="40" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
              <line x1="4" y1="20" x2="44" y2="20" stroke="currentColor" strokeWidth="2" />
              <line x1="16" y1="4" x2="16" y2="42" stroke="currentColor" strokeWidth="2" />
            </svg>
            <p className="text-sm">No work packages to display in Gantt view.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Timeline header (sticky, scrolls horizontally with body) */}
            <div
              className="overflow-hidden border-b border-gray-200"
              style={{ width: totalWidth + 200 }}
            >
              <GanttTimeline
                viewportStart={bounds.viewportStart}
                viewportEnd={bounds.viewportEnd}
                zoomLevel={zoomLevel}
                dayWidth={dayWidth}
                totalDays={bounds.totalDays}
              />
            </div>

            {/* Scrollable rows area */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-auto relative"
              onScroll={handleScroll}
            >
              {/* Today line */}
              <div
                style={{ width: totalWidth, height: totalHeight, position: 'relative' }}
              >
                <GanttTodayLine
                  viewportStart={bounds.viewportStart}
                  dayWidth={dayWidth}
                  totalHeight={totalHeight}
                />

                <GanttDependencyLines
                  dependencies={dependencies}
                  workPackagesMap={workPackagesMap}
                  rowMap={rowMap}
                  rowHeight={ROW_HEIGHT}
                  totalHeight={totalHeight}
                  totalWidth={totalWidth}
                />

                <GanttRows
                  items={ganttItems}
                  rowMap={rowMap}
                  rowHeight={ROW_HEIGHT}
                  zoomLevel={zoomLevel}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  onDatesChange={handleDatesChange}
                  onRowClick={handleRowClick}
                  totalWidth={totalWidth}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
