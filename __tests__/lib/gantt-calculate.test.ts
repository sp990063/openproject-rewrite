import { describe, it, expect } from 'vitest'
import {
  parseDate,
  calculateTimelineBounds,
  calculateGanttLayout,
  calculateRowIndices,
  calculatePath,
  calculateArrowHead,
  computeResizeDates,
  getDayWidth,
  ZOOM_LEVELS,
  zoomIn,
  zoomOut,
} from '@/lib/gantt/calculate'
import { addDays, subDays, startOfDay } from 'date-fns'
import type { WorkPackage } from '@/types'

// ─── Mock WorkPackage factory ─────────────────────────────────────────────────

function makeWP(overrides: Partial<WorkPackage> = {}): WorkPackage {
  return {
    id: 'wp1',
    projectId: 'p1',
    subject: 'Test WP',
    description: null,
    statusId: 's1',
    typeId: 't1',
    priorityId: 'pr1',
    startDate: new Date('2025-06-05'),
    dueDate: new Date('2025-06-20'),
    estimatedHours: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── parseDate ─────────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('returns Date as-is when valid', () => {
    const d = new Date('2025-06-15')
    expect(parseDate(d)).toEqual(d)
  })

  it('parses ISO date string', () => {
    const result = parseDate('2025-06-15')
    expect(result).toBeInstanceOf(Date)
    expect((result as Date | null)?.getFullYear()).toBe(2025)
  })

  it('returns null for null', () => {
    expect(parseDate(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseDate(undefined)).toBeNull()
  })

  it('returns null for invalid string', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })
})

// ─── getDayWidth ───────────────────────────────────────────────────────────────

describe('getDayWidth', () => {
  it('returns 40 for day zoom', () => {
    expect(getDayWidth('day')).toBe(40)
  })

  it('returns 20 for week zoom', () => {
    expect(getDayWidth('week')).toBe(20)
  })

  it('returns 8 for month zoom', () => {
    expect(getDayWidth('month')).toBe(8)
  })

  it('returns 3 for quarter zoom', () => {
    expect(getDayWidth('quarter')).toBe(3)
  })
})

// ─── ZOOM_LEVELS ───────────────────────────────────────────────────────────────

describe('ZOOM_LEVELS', () => {
  it('is an array of 4 zoom level objects', () => {
    expect(ZOOM_LEVELS).toHaveLength(4)
  })

  it('has positive dayWidth for all levels', () => {
    for (const level of ZOOM_LEVELS) {
      expect(level.dayWidth).toBeGreaterThan(0)
    }
  })

  it('dayWidth decreases as zoom level increases (quarter → day)', () => {
    // ZOOM_LEVELS is ordered quarter → month → week → day
    const widths = ZOOM_LEVELS.map((l) => l.dayWidth)
    expect(widths[0]).toBeLessThan(widths[1]) // quarter < month
    expect(widths[1]).toBeLessThan(widths[2]) // month < week
    expect(widths[2]).toBeLessThan(widths[3]) // week < day
  })

  it('has correct level values', () => {
    const levels = ZOOM_LEVELS.map((l) => l.level)
    expect(levels).toEqual(['quarter', 'month', 'week', 'day'])
  })
})

// ─── zoomIn / zoomOut ─────────────────────────────────────────────────────────

describe('zoomIn', () => {
  it('quarter → month', () => expect(zoomIn('quarter')).toBe('month'))
  it('month → week', () => expect(zoomIn('month')).toBe('week'))
  it('week → day', () => expect(zoomIn('week')).toBe('day'))
  it('day stays at day', () => expect(zoomIn('day')).toBe('day'))
})

describe('zoomOut', () => {
  it('day → week', () => expect(zoomOut('day')).toBe('week'))
  it('week → month', () => expect(zoomOut('week')).toBe('month'))
  it('month → quarter', () => expect(zoomOut('month')).toBe('quarter'))
  it('quarter stays at quarter', () => expect(zoomOut('quarter')).toBe('quarter'))
})

// ─── calculateTimelineBounds ───────────────────────────────────────────────────

describe('calculateTimelineBounds', () => {
  it('returns TimelineBounds with earliestStart and latestEnd', () => {
    const wps = [
      makeWP({ startDate: new Date('2025-06-05'), dueDate: new Date('2025-06-20') }),
      makeWP({ id: 'wp2', startDate: new Date('2025-06-10'), dueDate: new Date('2025-06-25') }),
    ]
    const result = calculateTimelineBounds(wps, 'month')
    expect(result.earliestStart).toBeInstanceOf(Date)
    expect(result.latestEnd).toBeInstanceOf(Date)
    expect(result.totalDays).toBeGreaterThan(0)
  })

  it('uses today ±30 days fallback when no work packages have dates', () => {
    const wps = [makeWP({ startDate: null, dueDate: null })]
    const before = new Date()
    const result = calculateTimelineBounds(wps, 'month')
    const after = new Date()
    // earliestStart should be approximately today - 30 days (within a day margin)
    expect(result.earliestStart.getTime()).toBeGreaterThanOrEqual(addDays(before, -31).getTime())
    expect(result.earliestStart.getTime()).toBeLessThanOrEqual(addDays(after, -29).getTime())
  })

  it('sets viewportStart before earliestStart and viewportEnd after latestEnd', () => {
    const wps = [makeWP({ startDate: new Date('2025-06-10'), dueDate: new Date('2025-06-20') })]
    const result = calculateTimelineBounds(wps, 'month')
    expect(result.viewportStart.getTime()).toBeLessThan(result.earliestStart.getTime())
    expect(result.viewportEnd.getTime()).toBeGreaterThan(result.latestEnd.getTime())
  })
})

// ─── calculateGanttLayout ──────────────────────────────────────────────────────

describe('calculateGanttLayout', () => {
  const viewportStart = new Date('2025-06-01')

  it('returns array of GanttWorkPackage objects', () => {
    const wps = [makeWP({ startDate: new Date('2025-06-05'), dueDate: new Date('2025-06-20') })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    expect(result).toHaveLength(1)
    expect(result[0].start).toBeInstanceOf(Date)
    expect(result[0].end).toBeInstanceOf(Date)
    expect(result[0].duration).toBeGreaterThan(0)
    expect(result[0].left).toBeGreaterThanOrEqual(0)
    expect(result[0].width).toBeGreaterThan(0)
  })

  it('uses viewportStart as fallback when startDate is null', () => {
    const wps = [makeWP({ startDate: null, dueDate: new Date('2025-06-20') })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    expect(result[0].start).toEqual(viewportStart)
  })

  it('uses viewportStart + 7 days as end fallback when dueDate is null', () => {
    const wps = [makeWP({ startDate: new Date('2025-06-10'), dueDate: null })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    expect(result[0].end).toEqual(addDays(new Date('2025-06-10'), 7))
  })

  it('calculates left = 0 for bar starting at viewportStart', () => {
    const wps = [makeWP({ startDate: viewportStart, dueDate: addDays(viewportStart, 5) })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    expect(result[0].left).toBe(0)
  })

  it('left is positive for bar starting after viewportStart', () => {
    const wps = [makeWP({ startDate: addDays(viewportStart, 5), dueDate: addDays(viewportStart, 10) })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    expect(result[0].left).toBeGreaterThan(0)
  })

  it('width = duration * dayWidth', () => {
    const wps = [makeWP({ startDate: viewportStart, dueDate: addDays(viewportStart, 10) })]
    const result = calculateGanttLayout(wps, { zoomLevel: 'month', viewportStart })
    // month zoom: dayWidth = 8, duration = 10
    expect(result[0].width).toBe(10 * 8)
  })
})

// ─── calculateRowIndices ───────────────────────────────────────────────────────

describe('calculateRowIndices', () => {
  it('returns Map<string, number>', () => {
    const items = [
      { id: 'a', start: new Date(), end: new Date(), duration: 5, progress: 0, left: 0, width: 40 } as any,
      { id: 'b', start: new Date(), end: new Date(), duration: 5, progress: 0, left: 100, width: 40 } as any,
    ]
    const result = calculateRowIndices(items)
    expect(result).toBeInstanceOf(Map)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0) // non-overlapping, same row
  })

  it('non-overlapping bars get row 0', () => {
    const items = [
      { id: 'a', left: 0, width: 20 } as any,
      { id: 'b', left: 100, width: 20 } as any,
    ]
    const result = calculateRowIndices(items)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
  })

  it('overlapping bars get different rows', () => {
    const items = [
      { id: 'a', left: 0, width: 80 } as any,
      { id: 'b', left: 50, width: 80 } as any, // overlaps with 'a'
    ]
    const result = calculateRowIndices(items)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(1) // b overlaps a, so goes to row 1
  })

  it('three overlapping bars get rows 0, 1, 2', () => {
    // All bars start at same position — all overlap with each other → each gets own row
    const items = [
      { id: 'a', left: 0, width: 80 } as any,
      { id: 'b', left: 0, width: 80 } as any,  // overlaps with a
      { id: 'c', left: 0, width: 80 } as any,  // overlaps with a and b
    ]
    const result = calculateRowIndices(items)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(1)
    expect(result.get('c')).toBe(2)
  })
})

// ─── calculatePath ─────────────────────────────────────────────────────────────

describe('calculatePath', () => {
  const barA = { left: 0, width: 50, row: 0 }
  const barB = { left: 200, width: 50, row: 0 }
  const barC = { left: 200, width: 50, row: 2 }

  it('returns SVG path string for FS dependency (finish-to-start)', () => {
    const path = calculatePath(barA, barB, 'FS')
    expect(typeof path).toBe('string')
    expect(path).toContain('M')
    expect(path).toContain('L')
  })

  it('returns SVG path string for SS dependency', () => {
    const path = calculatePath(barA, barB, 'SS')
    expect(typeof path).toBe('string')
    expect(path).toContain('M')
  })

  it('returns SVG path string for different-row dependency', () => {
    const path = calculatePath(barA, barC, 'FS')
    expect(typeof path).toBe('string')
    expect(path).toContain('M')
    expect(path).toContain('L')
  })
})

// ─── calculateArrowHead ────────────────────────────────────────────────────────

describe('calculateArrowHead', () => {
  it('returns polygon string with coordinates', () => {
    const polygon = calculateArrowHead(200, 50, 8)
    expect(typeof polygon).toBe('string')
    expect(polygon).toContain('200')
    expect(polygon).toContain('50')
    expect(polygon).toContain('Z') // close path
  })

  it('uses default size of 8', () => {
    const polygon = calculateArrowHead(100, 25)
    expect(polygon).toContain('100')
    expect(polygon).toContain('25')
  })
})

// ─── computeResizeDates ─────────────────────────────────────────────────────────

describe('computeResizeDates', () => {
  const viewportStart = new Date('2025-06-01')

  it('returns DragResizeResult with ISO string dates', () => {
    const result = computeResizeDates(
      new Date('2025-06-05'),
      new Date('2025-06-20'),
      80, // 80px = 10 days at dayWidth=8
      8,
      'left'
    )
    expect(result.newStartDate).not.toBeNull()
    expect(typeof result.newStartDate).toBe('string')
  })

  it('moves start date forward when dragging right (positive delta)', () => {
    const result = computeResizeDates(
      new Date('2025-06-05'),
      new Date('2025-06-20'),
      80, // 80px = 10 days at dayWidth=8
      8,
      'left'
    )
    const newDate = new Date(result.newStartDate!)
    expect(newDate.getDate()).toBe(15) // 5 + 10 days
  })

  it('moves start date backward when dragging left (negative delta)', () => {
    const result = computeResizeDates(
      new Date('2025-06-05'),
      new Date('2025-06-20'),
      -80,
      8,
      'left'
    )
    const newDate = new Date(result.newStartDate!)
    expect(newDate.getDate()).toBe(new Date('2025-05-26').getDate()) // 5 - 10
  })

  it('moves end date forward when dragging right on right edge', () => {
    const result = computeResizeDates(
      new Date('2025-06-05'),
      new Date('2025-06-20'),
      80,
      8,
      'right'
    )
    const newDate = new Date(result.newDueDate!)
    expect(newDate.getDate()).toBe(30) // 20 + 10
  })

  it('returns null startDate when originalStartDate is null (left edge)', () => {
    const result = computeResizeDates(null, new Date('2025-06-20'), 80, 8, 'left')
    expect(result.newStartDate).toBeNull()
  })

  it('returns null dueDate when originalDueDate is null (right edge)', () => {
    const result = computeResizeDates(new Date('2025-06-05'), null, 80, 8, 'right')
    expect(result.newDueDate).toBeNull()
  })
})
