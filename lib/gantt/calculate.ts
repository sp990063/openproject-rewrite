import { parseISO, isValid, differenceInDays, addDays } from 'date-fns'
import type { WorkPackage } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GanttZoomLevel = 'day' | 'week' | 'month' | 'quarter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GanttWorkPackage extends WorkPackage {
  // Computed for Gantt display
  start: Date
  end: Date
  duration: number // days
  progress: number // 0-100
  left: number // pixels from timeline start
  width: number // pixels based on duration
}

export interface GanttDependency {
  fromId: string
  toId: string
  type: DependencyType
}

export type DependencyType = 'SS' | 'SF' | 'FS' | 'FF'
// SS = Start-to-Start, SF = Start-to-Finish, FS = Finish-to-Start, FF = Finish-to-Finish

interface Point {
  x: number
  y: number
}

interface BarPosition {
  left: number
  width: number
  row: number
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a date value that may be a string, a Date object, or null/undefined.
 * - string → parseISO → validate → return Date | null
 * - Date   → validate → return Date | null
 * - null/undefined → return null
 */
export function parseDate(dateValue: string | Date | null | undefined): Date | null {
  if (!dateValue) return null
  try {
    if (dateValue instanceof Date) {
      return isValid(dateValue) ? dateValue : null
    }
    const parsed = parseISO(dateValue)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

// ─── Day Width ────────────────────────────────────────────────────────────────

export function getDayWidth(zoom: GanttZoomLevel): number {
  switch (zoom) {
    case 'day':     return 40
    case 'week':    return 20
    case 'month':   return 8
    case 'quarter': return 3
  }
}

// ─── Timeline Bounds ─────────────────────────────────────────────────────────

export interface TimelineBounds {
  earliestStart: Date
  latestEnd: Date
  totalDays: number
  viewportStart: Date
  viewportEnd: Date
}

/**
 * Calculate the overall timeline bounds given all work packages.
 * Falls back to ±30 days from today if no valid dates exist.
 */
export function calculateTimelineBounds(
  workPackages: WorkPackage[],
  zoomLevel: GanttZoomLevel
): TimelineBounds {
  let earliestStart: Date | null = null
  let latestEnd: Date | null = null

  for (const wp of workPackages) {
    const start = parseDate(wp.startDate)
    const end = parseDate(wp.dueDate)
    if (start && (!earliestStart || start < earliestStart)) earliestStart = start
    if (end && (!latestEnd || end > latestEnd)) latestEnd = end
  }

  const today = new Date()

  // Fallback if no dates
  const safeEarliest: Date = earliestStart ?? addDays(today, -30)
  const safeLatestEnd: Date = latestEnd ?? addDays(today, 30)

  // Extend the window based on zoom level (show padding around data)
  const paddingDays = zoomLevel === 'day' ? 7 : zoomLevel === 'week' ? 14 : 30
  const viewStart = addDays(safeEarliest, -paddingDays)
  const viewEnd = addDays(safeLatestEnd, paddingDays)

  const totalDays = Math.max(
    1,
    Math.abs(differenceInDays(safeLatestEnd as Date, safeEarliest as Date)) + paddingDays * 2
  )

  return {
    earliestStart: safeEarliest,
    latestEnd: safeLatestEnd,
    totalDays,
    viewportStart: viewStart,
    viewportEnd: viewEnd,
  }
}

// ─── Gantt Layout ─────────────────────────────────────────────────────────────

export interface GanttLayoutOptions {
  zoomLevel: GanttZoomLevel
  viewportStart: Date
  rowHeight?: number
}

export function calculateGanttLayout(
  workPackages: WorkPackage[],
  options: GanttLayoutOptions
): GanttWorkPackage[] {
  const { zoomLevel, viewportStart } = options
  const dayWidth = getDayWidth(zoomLevel)

  return workPackages.map((wp) => {
    const start = parseDate(wp.startDate)
    const end = parseDate(wp.dueDate)

    // CRITICAL: Do NOT use transform: scale() for zoom — it blurs text
    // and breaks hit detection for drag interactions.
    // Bars are sized using dayWidth (pixels per day).
    const validStart: Date = start != null ? start : viewportStart
    const validEnd: Date = end != null ? end : addDays(validStart, 7)

    if (!start || !end) {
      void wp.id // silence unused warning
    }

    const duration = Math.max(
      1,
      Math.abs(differenceInDays(validEnd as Date, validStart as Date))
    )

    return {
      ...wp,
      start: validStart as Date,
      end: validEnd as Date,
      duration,
      progress: wp.estimatedHours != null ? 50 : 0, // placeholder progress
      left: Math.max(
        0,
        differenceInDays(validStart as Date, viewportStart) * dayWidth
      ),
      width: duration * dayWidth,
    }
  })
}

// ─── Row Index Map ────────────────────────────────────────────────────────────

/**
 * Assign row indices to Gantt bars, handling overlapping bars.
 * Bars with the same row index are on the same horizontal line.
 * Returns a Map from workPackageId → rowIndex.
 */
export function calculateRowIndices(
  ganttItems: GanttWorkPackage[],
  rowHeight = 48
): Map<string, number> {
  const sorted = [...ganttItems].sort((a, b) => a.left - b.left)
  const rowMap = new Map<string, number>()
  const rowEndX: number[] = [] // rightmost x for each row

  for (const item of sorted) {
    const itemLeft = item.left
    const itemRight = item.left + item.width

    // Find a row that this item doesn't overlap
    let row = rowEndX.findIndex((endX) => endX <= itemLeft)
    if (row === -1) {
      // No free row, create a new one
      row = rowEndX.length
      rowEndX.push(itemRight)
    } else {
      // Occupy this row, update its end position
      rowEndX[row] = Math.max(rowEndX[row], itemRight)
    }

    rowMap.set(item.id, row)
  }

  return rowMap
}

// ─── Dependency Path ──────────────────────────────────────────────────────────

/**
 * Calculate SVG path for a dependency arrow between two Gantt bars.
 * Returns an orthogonal path with an arrow head.
 */
export function calculatePath(
  from: BarPosition,
  to: BarPosition,
  type: DependencyType,
  ROW_HEIGHT = 48
): string {
  const fromY = from.row * ROW_HEIGHT + ROW_HEIGHT / 2
  const toY = to.row * ROW_HEIGHT + ROW_HEIGHT / 2

  // Determine connection points based on dependency type
  let startX: number
  let endX: number

  switch (type) {
    case 'SS':
      startX = from.left
      endX = to.left
      break
    case 'SF':
      startX = from.left
      endX = to.left + to.width
      break
    case 'FS':
      startX = from.left + from.width
      endX = to.left
      break
    case 'FF':
      startX = from.left + from.width
      endX = to.left + to.width
      break
  }

  const arrowSize = 8

  if (Math.abs(fromY - toY) < 1) {
    // Same row — simple horizontal line with arrow
    return `M ${startX} ${fromY} L ${endX - arrowSize} ${toY}`
  }

  // Different rows — orthogonal path with bend
  const midX = Math.min(startX, endX) - 16 // offset to the left of both bars

  const path = [
    `M ${startX} ${fromY}`,
    `L ${midX} ${fromY}`,
    `L ${midX} ${toY}`,
    `L ${endX - arrowSize} ${toY}`,
  ].join(' ')

  return path
}

/**
 * Calculate arrow head path pointing toward (endX, endY).
 */
export function calculateArrowHead(endX: number, endY: number, size = 8): string {
  return `M ${endX} ${endY} L ${endX - size} ${endY - size / 2} L ${endX - size} ${endY + size / 2} Z`
}

// ─── Drag Resize Helpers ──────────────────────────────────────────────────────

export interface DragResizeResult {
  newStartDate: string | null
  newDueDate: string | null
}

/**
 * Given a Gantt bar's original dates and a pixel delta from drag,
 * compute the new dates. dayWidth controls px→days conversion.
 * Accepts Date | null since WorkPackage uses Date | null.
 */
export function computeResizeDates(
  originalStartDate: Date | null,
  originalDueDate: Date | null,
  pixelDelta: number,
  dayWidth: number,
  edge: 'left' | 'right'
): DragResizeResult {
  const daysDelta = Math.round(pixelDelta / dayWidth)

  if (edge === 'left') {
    const newStart = originalStartDate
      ? addDays(originalStartDate, daysDelta)
      : null
    return {
      newStartDate: newStart ? newStart.toISOString() : null,
      newDueDate: originalDueDate ? originalDueDate.toISOString() : null,
    }
  } else {
    const newDue = originalDueDate
      ? addDays(originalDueDate, daysDelta)
      : null
    return {
      newStartDate: originalStartDate ? originalStartDate.toISOString() : null,
      newDueDate: newDue ? newDue.toISOString() : null,
    }
  }
}

// ─── Zoom ─────────────────────────────────────────────────────────────────────

export const ZOOM_LEVELS: { level: GanttZoomLevel; label: string; dayWidth: number }[] = [
  { level: 'quarter', label: 'Quarter', dayWidth: 3 },
  { level: 'month',   label: 'Month',   dayWidth: 8 },
  { level: 'week',    label: 'Week',    dayWidth: 20 },
  { level: 'day',     label: 'Day',     dayWidth: 40 },
]

export function zoomIn(current: GanttZoomLevel): GanttZoomLevel {
  const order: GanttZoomLevel[] = ['quarter', 'month', 'week', 'day']
  const idx = order.indexOf(current)
  return order[Math.min(idx + 1, order.length - 1)]
}

export function zoomOut(current: GanttZoomLevel): GanttZoomLevel {
  const order: GanttZoomLevel[] = ['quarter', 'month', 'week', 'day']
  const idx = order.indexOf(current)
  return order[Math.max(idx - 1, 0)]
}
