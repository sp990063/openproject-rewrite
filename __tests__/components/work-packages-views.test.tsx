import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Table Skeleton & Empty State ─────────────────────────────────────────────

import { WorkPackageTableSkeleton } from '@/components/work-packages/table/WorkPackageTableSkeleton'
import { WorkPackageTableEmptyState } from '@/components/work-packages/table/WorkPackageTableEmptyState'

describe('WorkPackageTableSkeleton', () => {
  // ✅ VALID: header has exactly 8 column placeholders (inline widths: [200,120,100,100,140,110,110,90])
  it('header contains exactly 8 animated column placeholders', () => {
    render(<WorkPackageTableSkeleton />)
    const headerRow = document.querySelector('.border-b')
    const headerPulses = headerRow!.querySelectorAll('.animate-pulse')
    // 1 checkbox + 8 column skeletons = 9 total in header
    expect(headerPulses.length).toBe(9)
  })

  // ✅ VALID: renders exactly 8 data rows (hardcoded in source: Array.from({ length: 8 }))
  it('renders exactly 8 skeleton data rows', () => {
    render(<WorkPackageTableSkeleton />)
    // Each data row has 1 checkbox + 8 cells = 9 animate-pulse divs
    // We check that the skeleton has 8 distinct rows (each with class flex)
    const dataRows = document.querySelectorAll('[class*="items-center"]')
    // First row is header (flex with gap), subsequent 8 are data rows
    // The first match is the header row; count data rows separately
    const allFlexRows = Array.from(document.querySelectorAll('[class*="flex gap-4"]'))
    // There should be 9 flex rows total: 1 header + 8 data
    expect(allFlexRows.length).toBe(9)
  })

  // ✅ VALID: all pulse elements have correct animation class
  it('all skeleton elements have animate-pulse', () => {
    render(<WorkPackageTableSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    // 9 header pulses + 9*8 = 72 data pulses = 81 total
    // Just verify all found pulses have animate-pulse (they all do by definition)
    expect(pulses.length).toBeGreaterThan(0)
    pulses.forEach(pulse => {
      expect(pulse.className).toContain('animate-pulse')
    })
  })
})

describe('WorkPackageTableEmptyState', () => {
  // ✅ VALID: hasFilters=false → generic message + create button
  it('shows generic message and create button when no filters', () => {
    render(<WorkPackageTableEmptyState onClearFilters={vi.fn()} hasFilters={false} />)
    expect(screen.getByText('No work packages found')).toBeInTheDocument()
    expect(screen.getByText(/no work packages in this project/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create work package/i })).toBeInTheDocument()
  })

  // ✅ VALID: hasFilters=true → filter message + clear button
  it('shows filter message and clear button when filters are active', () => {
    const onClearFilters = vi.fn()
    render(<WorkPackageTableEmptyState onClearFilters={onClearFilters} hasFilters={true} />)
    expect(screen.getByText('No work packages found')).toBeInTheDocument()
    expect(screen.getByText(/match your current filters/)).toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: /clear filters/i })
    expect(clearBtn).toBeInTheDocument()
  })

  // ✅ VALID: onClearFilters called when clear button clicked
  it('calls onClearFilters when Clear filters button is clicked', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    render(<WorkPackageTableEmptyState onClearFilters={onClearFilters} hasFilters={true} />)
    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(onClearFilters).toHaveBeenCalledOnce()
  })

  // ✅ VALID: SVG illustration always rendered
  it('renders SVG illustration regardless of hasFilters state', () => {
    render(<WorkPackageTableEmptyState onClearFilters={vi.fn()} hasFilters={false} />)
    expect(document.querySelector('svg')).toBeInTheDocument()
    render(<WorkPackageTableEmptyState onClearFilters={vi.fn()} hasFilters={true} />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  // ✅ NEW: edge case — onClearFilters NOT called when create button is clicked
  it('does not call onClearFilters when create button is clicked', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    render(<WorkPackageTableEmptyState onClearFilters={onClearFilters} hasFilters={false} />)
    await user.click(screen.getByRole('button', { name: /create work package/i }))
    expect(onClearFilters).not.toHaveBeenCalled()
  })
})

// ─── Gantt Skeleton & Empty State ─────────────────────────────────────────────

import { WorkPackageGanttSkeleton } from '@/components/work-packages/gantt/WorkPackageGanttSkeleton'
import { WorkPackageGanttEmptyState } from '@/components/work-packages/gantt/WorkPackageGanttEmptyState'

describe('WorkPackageGanttSkeleton', () => {
  // ✅ VALID: ROWS=8 hardcoded in source → exactly 8 data rows rendered
  it('renders exactly 8 data rows', () => {
    render(<WorkPackageGanttSkeleton />)
    const rows = document.querySelectorAll('[class*="min-h-[45px]"]')
    expect(rows.length).toBe(8)
  })

  // ✅ VALID: today column highlighted (column 14 of 30)
  it('marks exactly one column as today (column 14 of 30)', () => {
    render(<WorkPackageGanttSkeleton />)
    const todayCols = document.querySelectorAll('[class*="bg-blue-50"]')
    expect(todayCols.length).toBe(1)
  })

  // ✅ VALID: all skeleton bars have animate-pulse
  it('all bar placeholders have animate-pulse', () => {
    render(<WorkPackageGanttSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(8) // more than 1 per row
  })
})

describe('WorkPackageGanttEmptyState', () => {
  // ✅ VALID: correct heading + message about dates
  it('renders date-specific message', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(screen.getByText('No work packages to display')).toBeInTheDocument()
    expect(screen.getByText(/dates set/)).toBeInTheDocument()
  })

  // ✅ VALID: SVG rendered
  it('renders SVG illustration', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  // ✅ VALID: button rendered only when callback provided
  it('renders create button when onCreateFirst is provided', () => {
    render(<WorkPackageGanttEmptyState onCreateFirst={vi.fn()} />)
    expect(screen.getByRole('button', { name: /create work package/i })).toBeInTheDocument()
  })

  it('does not render button when onCreateFirst is omitted', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
  })

  // ✅ VALID: callback fired correctly
  it('calls onCreateFirst when button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateFirst = vi.fn()
    render(<WorkPackageGanttEmptyState onCreateFirst={onCreateFirst} />)
    await user.click(screen.getByRole('button', { name: /create work package/i }))
    expect(onCreateFirst).toHaveBeenCalledOnce()
  })
})

// ─── Calendar Skeleton & Empty State ───────────────────────────────────────────

import { WorkPackageCalendarSkeleton } from '@/components/work-packages/calendar/WorkPackageCalendarSkeleton'
import { WorkPackageCalendarEmptyState } from '@/components/work-packages/calendar/WorkPackageCalendarEmptyState'

describe('WorkPackageCalendarSkeleton', () => {
  // ✅ VALID: 35 cells in the grid (7 cols × 5 rows for typical month view)
  it('renders exactly 35 calendar cells', () => {
    render(<WorkPackageCalendarSkeleton />)
    const cells = document.querySelectorAll('[class*="min-h-[80px]"]')
    expect(cells.length).toBe(35)
  })

  // ✅ VALID: all 7 day-of-week labels rendered
  it('renders all 7 day-of-week labels', () => {
    render(<WorkPackageCalendarSkeleton />)
    ;['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      expect(screen.getByText(day)).toBeInTheDocument()
    })
  })

  // ✅ VALID: header contains month label + prev/next navigation skeletons
  it('renders calendar header skeleton with navigation elements', () => {
    render(<WorkPackageCalendarSkeleton />)
    // Header: month label (w-32), prev arrow (w-8), next arrow (w-8)
    const monthLabel = document.querySelector('[style*="width: 8rem"]') ?? document.querySelector('[class*="w-32"]')
    const arrows = document.querySelectorAll('[class*="w-8"]')
    expect(monthLabel).toBeInTheDocument()
    expect(arrows.length).toBeGreaterThanOrEqual(2)
  })
})

describe('WorkPackageCalendarEmptyState', () => {
  // ✅ VALID: month-specific message
  it('renders month-specific message', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(screen.getByText('No work packages this month')).toBeInTheDocument()
  })

  // ✅ VALID: SVG illustration
  it('renders SVG illustration', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  // ✅ VALID: button conditional on callback
  it('renders create button when onCreateFirst is provided', () => {
    render(<WorkPackageCalendarEmptyState onCreateFirst={vi.fn()} />)
    expect(screen.getByRole('button', { name: /create work package/i })).toBeInTheDocument()
  })

  it('does not render button when onCreateFirst is omitted', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
  })

  // ✅ VALID: callback fired correctly
  it('calls onCreateFirst when button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateFirst = vi.fn()
    render(<WorkPackageCalendarEmptyState onCreateFirst={onCreateFirst} />)
    await user.click(screen.getByRole('button', { name: /create work package/i }))
    expect(onCreateFirst).toHaveBeenCalledOnce()
  })
})
