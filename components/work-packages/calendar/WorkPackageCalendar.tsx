import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns'
import { useWorkPackages, useUpdateWorkPackage } from '@/hooks/use-work-packages'
import { WorkPackageCalendarHeader } from './WorkPackageCalendarHeader'
import { WorkPackageCalendarGrid } from './WorkPackageCalendarGrid'
import type { WorkPackageFilter, WorkPackage } from '@/types'
import type { CalendarViewMode } from './WorkPackageCalendarHeader'

export type { CalendarViewMode }

interface WorkPackageCalendarProps {
  initialFilters?: Partial<WorkPackageFilter>
  projectId?: string
}

export function WorkPackageCalendar({ initialFilters = {}, projectId }: WorkPackageCalendarProps) {
  const router = useRouter()
  const resolvedProjectId = projectId ?? (router.query.projectId as string | undefined)

  // ── View state ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())

  // ── DnD state ─────────────────────────────────────────────────────────────────
  const [activeWpId, setActiveWpId] = useState<string | null>(null)

  // ── Date range for server-side filtering ────────────────────────────────────
  // CRITICAL: Date range is sent to the server which does the filtering.
  // We do NOT load all work packages and filter client-side.
  const { dateRange } = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      return {
        dateRange: { gte: format(monthStart, 'yyyy-MM-dd'), lte: format(monthEnd, 'yyyy-MM-dd') },
      }
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return {
        dateRange: { gte: format(weekStart, 'yyyy-MM-dd'), lte: format(weekEnd, 'yyyy-MM-dd') },
      }
    }
  }, [viewMode, currentDate])

  // ── Server-side filtering via useWorkPackages ───────────────────────────────
  // CRITICAL: Do NOT load all work packages and filter client-side.
  // The API filters by date range server-side using the startDateGte/startDateLte params.
  const filters: WorkPackageFilter = {
    ...initialFilters,
    ...(resolvedProjectId ? { projectId: resolvedProjectId } : {}),
    startDate: dateRange,
  }

  const { workPackages } = useWorkPackages(filters)
  const updateWorkPackage = useUpdateWorkPackage()

  const wpData = workPackages.data ?? []

  // ── Calendar days ───────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
      return eachDayOfInterval({ start: calStart, end: calEnd })
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start: weekStart, end: weekEnd })
    }
  }, [viewMode, currentDate])

  // Group work packages by date for quick lookup
  const workPackagesByDate = useMemo(() => {
    const map = new Map<string, WorkPackage[]>()
    for (const wp of wpData) {
      // Show in calendar if it starts on this date
      const dateKey = wp.startDate
        ? format(wp.startDate instanceof Date ? wp.startDate : new Date(wp.startDate), 'yyyy-MM-dd')
        : null
      if (dateKey) {
        if (!map.has(dateKey)) map.set(dateKey, [])
        map.get(dateKey)!.push(wp)
      }
      // Also show if it spans this date (due date)
      if (wp.dueDate) {
        const dueKey = format(wp.dueDate instanceof Date ? wp.dueDate : new Date(wp.dueDate), 'yyyy-MM-dd')
        if (!map.has(dueKey)) map.set(dueKey, [])
        map.get(dueKey)!.push(wp)
      }
    }
    return map
  }, [wpData])

  // ── DnD sensors ──────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating drag
      },
    })
  )

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goToPrev = useCallback(() => {
    if (viewMode === 'month') setCurrentDate((d) => subMonths(d, 1))
    else setCurrentDate((d) => subWeeks(d, 1))
  }, [viewMode])

  const goToNext = useCallback(() => {
    if (viewMode === 'month') setCurrentDate((d) => addMonths(d, 1))
    else setCurrentDate((d) => addWeeks(d, 1))
  }, [viewMode])

  const goToToday = useCallback(() => setCurrentDate(new Date()), [])

  // ── Event handlers ───────────────────────────────────────────────────────────
  const handleEventClick = useCallback(
    (wpId: string) => {
      if (resolvedProjectId) {
        void router.push(`/projects/${resolvedProjectId}/work-packages/${wpId}`)
      }
    },
    [router, resolvedProjectId]
  )

  // ── DnD handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveWpId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveWpId(null)

      if (!over) return

      // over.id is the date string (yyyy-MM-dd) from the droppable cell
      const newDateStr = over.id as string
      if (!newDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(newDateStr)) return
      if (active.id === over.id) return // Dropped on same cell

      try {
        // Update the work package's start date to the new date
        await updateWorkPackage.mutateAsync({
          id: active.id as string,
          data: { startDate: newDateStr },
        })
      } catch {
        // TODO: show error toast
      }
    },
    [updateWorkPackage]
  )

  // ── Active work package for drag overlay ────────────────────────────────────
  const activeWp = activeWpId ? wpData.find((wp) => wp.id === activeWpId) : null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-white">
        <WorkPackageCalendarHeader
          currentDate={currentDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPrev={goToPrev}
          onNext={goToNext}
          onToday={goToToday}
        />

        <div className="flex-1 overflow-hidden">
          {workPackages.isLoading ? (
            <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
          ) : workPackages.isError ? (
            <div className="flex items-center justify-center h-64 text-red-500">Failed to load work packages.</div>
          ) : (
            <WorkPackageCalendarGrid
              days={days}
              workPackagesByDate={workPackagesByDate}
              viewMode={viewMode}
              currentDate={currentDate}
              onEventClick={handleEventClick}
            />
          )}
        </div>
      </div>

      {/* Drag overlay — shows a floating preview of the dragged event */}
      <DragOverlay>
        {activeWp ? (
          <div
            className="px-2 py-1 rounded text-xs font-medium text-white shadow-lg cursor-grabbing opacity-90"
            style={{ backgroundColor: activeWp.type?.color ?? activeWp.status?.color ?? '#6366F1' }}
          >
            {activeWp.subject}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
