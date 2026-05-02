import React, { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
} from 'date-fns'
import { useWorkPackages, useUpdateWorkPackage } from '@/hooks/use-work-packages'
import { WorkPackageCalendarHeader } from './WorkPackageCalendarHeader'
import { WorkPackageCalendarGrid } from './WorkPackageCalendarGrid'
import type { WorkPackageFilter } from '@/types'

export type CalendarViewMode = 'month' | 'week'

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

  // ── Date range for server-side filtering ────────────────────────────────────
  const { dateRange, endDate } = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      return {
        dateRange: { gte: format(monthStart, 'yyyy-MM-dd'), lte: format(monthEnd, 'yyyy-MM-dd') },
        endDate: undefined,
      }
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
      return {
        dateRange: { gte: format(weekStart, 'yyyy-MM-dd'), lte: format(weekEnd, 'yyyy-MM-dd') },
        endDate: undefined,
      }
    }
  }, [viewMode, currentDate])

  // ── Server-side filtering via useWorkPackages ───────────────────────────────
  // CRITICAL: Do NOT load all work packages and filter client-side.
  // Use the date range to filter server-side.
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
    const map = new Map<string, typeof wpData>()
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

  // ── Event handlers ────────────────────────────────────────────────────────────
  const handleEventClick = useCallback(
    (wpId: string) => {
      if (resolvedProjectId) {
        void router.push(`/projects/${resolvedProjectId}/work-packages/${wpId}`)
      }
    },
    [router, resolvedProjectId]
  )

  // ── Drag to change dates ─────────────────────────────────────────────────────
  const handleEventDrop = useCallback(
    async (wpId: string, newDate: Date) => {
      try {
        await updateWorkPackage.mutateAsync({
          id: wpId,
          data: { startDate: format(newDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") },
        })
      } catch {
        // TODO: show error toast
      }
    },
    [updateWorkPackage]
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
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
            onEventDrop={handleEventDrop}
          />
        )}
      </div>
    </div>
  )
}
