import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Components under test ────────────────────────────────────────────────────
import { GanttBar } from '@/components/work-packages/gantt/GanttBar'
import { GanttTimeline } from '@/components/work-packages/gantt/GanttTimeline'
import { GanttRows } from '@/components/work-packages/gantt/GanttRows'
import { GanttZoomControls } from '@/components/work-packages/gantt/GanttZoomControls'
import { GanttTodayLine } from '@/components/work-packages/gantt/GanttTodayLine'
import { GanttDependencyLines } from '@/components/work-packages/gantt/GanttDependencyLines'
import { WorkPackageGanttSkeleton } from '@/components/work-packages/gantt/WorkPackageGanttSkeleton'
import { WorkPackageGanttEmptyState } from '@/components/work-packages/gantt/WorkPackageGanttEmptyState'
import type { GanttWorkPackage, GanttDependency } from '@/components/work-packages/gantt/types'
import type { GanttZoomLevel } from '@/lib/gantt/calculate'

// ─── Shared fixtures ───────────────────────────────────────────────────────────
const mockItem = (overrides: Partial<GanttWorkPackage> = {}): GanttWorkPackage => ({
  id: 'wp1',
  projectId: 'prj1',
  subject: 'Test Task',
  description: null,
  typeId: 't1',
  statusId: 's1',
  priorityId: 'p1',
  assigneeId: null,
  startDate: '2026-06-01',
  dueDate: '2026-06-15',
  estimatedHours: null,
  storyPoints: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  start: new Date('2026-06-01'),
  end: new Date('2026-06-15'),
  duration: 14,
  progress: 50,
  left: 100,
  width: 112,
  status: { id: 's1', name: 'In Progress', color: '#3B82F6', isClosed: false, position: 1, createdAt: new Date(), updatedAt: new Date() },
  ...overrides,
})

// ─── GanttZoomControls ─────────────────────────────────────────────────────────

describe('GanttZoomControls', () => {
  const defaultProps = {
    zoomLevel: 'month' as GanttZoomLevel,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders zoom in and zoom out buttons
  it('renders Zoom In and Zoom Out buttons', () => {
    render(<GanttZoomControls {...defaultProps} />)
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument()
  })

  // ✅ VALID: zoom in button disabled at max zoom (day)
  it('Zoom In button is disabled at day zoom level', () => {
    render(<GanttZoomControls {...defaultProps} zoomLevel="day" />)
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled()
  })

  // ✅ VALID: zoom out button disabled at min zoom (quarter)
  it('Zoom Out button is disabled at quarter zoom level', () => {
    render(<GanttZoomControls {...defaultProps} zoomLevel="quarter" />)
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled()
  })

  // ✅ VALID: clicking Zoom In calls onZoomIn
  it('calls onZoomIn when Zoom In button is clicked', async () => {
    const user = userEvent.setup()
    render(<GanttZoomControls {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(defaultProps.onZoomIn).toHaveBeenCalledOnce()
  })

  // ✅ VALID: clicking Zoom Out calls onZoomOut
  it('calls onZoomOut when Zoom Out button is clicked', async () => {
    const user = userEvent.setup()
    render(<GanttZoomControls {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(defaultProps.onZoomOut).toHaveBeenCalledOnce()
  })

  // ✅ VALID: renders current zoom level label
  it('renders current zoom level label', () => {
    render(<GanttZoomControls {...defaultProps} zoomLevel="week" />)
    expect(screen.getByText('Week')).toBeInTheDocument()
  })
})

// ─── GanttTimeline ────────────────────────────────────────────────────────────

describe('GanttTimeline', () => {
  const defaultProps = {
    viewportStart: new Date('2026-06-01'),
    viewportEnd: new Date('2026-06-30'),
    zoomLevel: 'month' as GanttZoomLevel,
    dayWidth: 8,
    totalDays: 30,
  }

  // ✅ VALID: renders month row with month labels
  it('renders month labels in the timeline header', () => {
    render(<GanttTimeline {...defaultProps} />)
    // Should show "June 2026" in header
    expect(screen.getByText(/june 2026/i)).toBeInTheDocument()
  })

  // ✅ VALID: renders day numbers at day zoom level
  it('renders individual day numbers at day zoom level', () => {
    render(<GanttTimeline {...defaultProps} zoomLevel="day" dayWidth={40} totalDays={7} viewportEnd={new Date('2026-06-07')} />)
    // Day numbers like "1", "2", "3" etc.
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // ✅ VALID: renders week labels at week zoom level
  it('renders week labels at week zoom level', () => {
    render(<GanttTimeline {...defaultProps} zoomLevel="week" dayWidth={20} totalDays={28} />)
    // Week labels like "W23" — use getAllByText since there are multiple weeks
    const weekLabels = screen.getAllByText(/w\d+/i)
    expect(weekLabels.length).toBeGreaterThan(0)
  })

  // ✅ VALID: hides day/week sub-row at month zoom
  it('does not render day row at month zoom level', () => {
    render(<GanttTimeline {...defaultProps} zoomLevel="month" />)
    // Month view should NOT show individual day numbers
    // Just the month header rows
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  // ✅ VALID: shows month name at quarter zoom
  it('renders month name at quarter zoom', () => {
    render(<GanttTimeline {...defaultProps} zoomLevel="quarter" dayWidth={3} totalDays={90} />)
    // Should contain month+year text
    const monthLabels = screen.getAllByText(/[A-Z][a-z]+ 2026/)
    expect(monthLabels.length).toBeGreaterThan(0)
  })
})

// ─── GanttBar ─────────────────────────────────────────────────────────────────

describe('GanttBar', () => {
  const defaultProps = {
    item: mockItem(),
    row: 0,
    rowHeight: 48,
    zoomLevel: 'month' as GanttZoomLevel,
    isSelected: false,
    onSelect: vi.fn(),
    onDatesChange: vi.fn(),
    onClick: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders bar with subject text
  it('renders bar with subject label', () => {
    render(<GanttBar {...defaultProps} />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  // ✅ VALID: renders aria-label with subject and status
  it('has correct aria-label', () => {
    render(<GanttBar {...defaultProps} />)
    const bar = screen.getByRole('button')
    expect(bar).toHaveAttribute('aria-label', 'Test Task (In Progress)')
  })

  // ✅ VALID: renders with correct left and width positioning
  it('applies left and width positioning from item', () => {
    render(<GanttBar {...defaultProps} item={mockItem({ left: 200, width: 160 })} />)
    const bar = screen.getByRole('button')
    expect(bar.style.left).toBe('200px')
    expect(bar.style.width).toBe('160px')
  })

  // ✅ VALID: selected state adds blue ring
  it('adds selection ring when isSelected is true', () => {
    render(<GanttBar {...defaultProps} isSelected={true} />)
    // The selection ring is a div inside the bar
    const ring = document.querySelector('.border-2.border-blue-500')
    expect(ring).toBeInTheDocument()
  })

  // ✅ VALID: no ring when not selected
  it('does not render selection ring when not selected', () => {
    render(<GanttBar {...defaultProps} isSelected={false} />)
    const ring = document.querySelector('.border-2.border-blue-500')
    expect(ring).not.toBeInTheDocument()
  })

  // ✅ VALID: onClick fires on bar click
  it('calls onClick when bar is clicked', async () => {
    const user = userEvent.setup()
    render(<GanttBar {...defaultProps} />)
    await user.click(screen.getByRole('button'))
    expect(defaultProps.onClick).toHaveBeenCalledWith('wp1')
  })

  // ✅ VALID: onSelect fires when checkbox (not in bar) — actually bar has no checkbox
  // ✅ VALID: resize handles exist (left and right drag handles)
  it('renders left and right resize handles', () => {
    render(<GanttBar {...defaultProps} />)
    expect(screen.getByLabelText(/drag to resize from left/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/drag to resize from right/i)).toBeInTheDocument()
  })

  // ✅ VALID: progress fill bar renders
  it('renders progress fill', () => {
    render(<GanttBar {...defaultProps} item={mockItem({ progress: 75 })} />)
    // Progress fill is a div inside the bar
    const fills = document.querySelectorAll('.absolute.top-0.left-0')
    expect(fills.length).toBeGreaterThan(0)
  })

  // ✅ VALID: status color applied to bar
  it('applies status color to bar background', () => {
    render(<GanttBar {...defaultProps} />)
    const bar = screen.getByRole('button')
    // backgroundColor is hex + '30' alpha
    expect(bar.style.backgroundColor).toBeTruthy()
  })

  // ✅ VALID: bar is role="button" (accessible)
  it('bar is accessible as a button', () => {
    render(<GanttBar {...defaultProps} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})

// ─── GanttRows ─────────────────────────────────────────────────────────────────

describe('GanttRows', () => {
  const defaultProps = {
    items: [mockItem({ id: 'wp1', left: 100, width: 112 })],
    rowMap: new Map([['wp1', 0]]),
    rowHeight: 48,
    zoomLevel: 'month' as GanttZoomLevel,
    selectedIds: new Set<string>(),
    onSelect: vi.fn(),
    onDatesChange: vi.fn(),
    onRowClick: vi.fn(),
    totalWidth: 1000,
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders bars for items
  it('renders GanttBar for each item', () => {
    render(<GanttRows {...defaultProps} />)
    expect(screen.getByRole('button', { name: /test task/i })).toBeInTheDocument()
  })

  // ✅ VALID: renders alternating row backgrounds
  it('renders row background stripes', () => {
    render(<GanttRows {...defaultProps} />)
    // Even row (row 0) should be white, odd row would be gray
    // Just verify row backgrounds exist
    const stripes = document.querySelectorAll('[class*="absolute"]')
    expect(stripes.length).toBeGreaterThan(0)
  })

  // ✅ VALID: selected bar shows selection ring
  it('renders selected bar with ring', () => {
    render(<GanttRows {...defaultProps} selectedIds={new Set(['wp1'])} />)
    const ring = document.querySelector('.border-2.border-blue-500')
    expect(ring).toBeInTheDocument()
  })

  // ✅ VALID: multiple items render multiple bars
  it('renders multiple bars for multiple items', () => {
    render(<GanttRows {...defaultProps} items={[
      mockItem({ id: 'wp1', left: 100, width: 112 }),
      mockItem({ id: 'wp2', subject: 'Second Task', left: 200, width: 80 }),
    ]} rowMap={new Map([['wp1', 0], ['wp2', 1]])} />)
    expect(screen.getByRole('button', { name: /test task/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /second task/i })).toBeInTheDocument()
  })
})

// ─── GanttTodayLine ─────────────────────────────────────────────────────────────

describe('GanttTodayLine', () => {
  // ✅ VALID: renders today line and label when today is within viewport
  // NOTE: viewportStart must be far enough in the past so x = (today - viewportStart) * dayWidth > 0
  // Today (2026-05-08) minus 2026-01-01 = ~128 days * 8 = 1024px
  it('renders a vertical line when today is within viewport', () => {
    render(
      <GanttTodayLine
        viewportStart={new Date('2026-01-01')}
        dayWidth={8}
        totalHeight={480}
      />
    )
    // Today is within the viewport → renders the <g> with a <line>
    const line = document.querySelector('line')
    expect(line).toBeInTheDocument()
  })

  // ✅ VALID: renders today marker label
  it('renders a today label', () => {
    render(
      <GanttTodayLine
        viewportStart={new Date('2026-01-01')}
        dayWidth={8}
        totalHeight={480}
      />
    )
    expect(screen.getByText(/today/i)).toBeInTheDocument()
  })

  // ✅ VALID: returns null when today is before viewport
  it('returns null when today is before viewport', () => {
    const { container } = render(
      <GanttTodayLine
        viewportStart={new Date('2099-01-01')}
        dayWidth={8}
        totalHeight={480}
      />
    )
    // x = (today - 2099-01-01) which is negative → renders nothing
    expect(container.firstChild).toBeNull()
  })
})

// ─── GanttDependencyLines ───────────────────────────────────────────────────────

describe('GanttDependencyLines', () => {
  // ✅ VALID: renders an SVG container (with no path children when deps are empty)
  it('renders SVG container even when dependencies array is empty', () => {
    render(
      <GanttDependencyLines
        dependencies={[]}
        workPackagesMap={new Map()}
        rowMap={new Map()}
        rowHeight={48}
        totalHeight={480}
        totalWidth={1000}
      />
    )
    const svg = document.querySelector('svg.gantt-dependencies')
    expect(svg).toBeInTheDocument()
    // No path children when dependencies array is empty
    expect(svg?.querySelectorAll('path')).toHaveLength(0)
  })
})

// ─── WorkPackageGanttSkeleton ──────────────────────────────────────────────────

describe('WorkPackageGanttSkeleton', () => {
  // ✅ VALID: renders skeleton with animated placeholders
  it('renders skeleton UI with animated elements', () => {
    render(<WorkPackageGanttSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })

  // ✅ VALID: renders bar-shaped skeleton placeholders
  it('renders multiple bar-shaped skeleton rows', () => {
    render(<WorkPackageGanttSkeleton />)
    // Should have bar-shaped skeletons (rectangles)
    const skeletons = document.querySelectorAll('[class*="rounded"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

// ─── WorkPackageGanttEmptyState ────────────────────────────────────────────────

describe('WorkPackageGanttEmptyState', () => {
  // ✅ VALID: renders heading message
  it('renders no work packages heading', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(screen.getByText('No work packages to display')).toBeInTheDocument()
  })

  // ✅ VALID: renders descriptive sub-text
  it('renders descriptive message about dates', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(screen.getByText(/there are no work packages with dates set/i)).toBeInTheDocument()
  })

  // ✅ VALID: renders an SVG illustration
  it('renders SVG illustration', () => {
    render(<WorkPackageGanttEmptyState />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })
})
