import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Components under test ────────────────────────────────────────────────────
import { WorkPackageCalendar } from '@/components/work-packages/calendar/WorkPackageCalendar'
import { WorkPackageCalendarHeader } from '@/components/work-packages/calendar/WorkPackageCalendarHeader'
import { WorkPackageCalendarGrid } from '@/components/work-packages/calendar/WorkPackageCalendarGrid'
import { WorkPackageCalendarSkeleton } from '@/components/work-packages/calendar/WorkPackageCalendarSkeleton'
import { WorkPackageCalendarEmptyState } from '@/components/work-packages/calendar/WorkPackageCalendarEmptyState'
import type { CalendarViewMode } from '@/components/work-packages/calendar/WorkPackageCalendar'
import type { WorkPackage } from '@/types'

// ─── Mock next/router ─────────────────────────────────────────────────────────
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), query: { projectId: 'prj1' } }),
}))

// ─── Mock use-work-packages hook ───────────────────────────────────────────────
const mockUseWorkPackages = vi.fn()
const mockUseUpdateWorkPackage = vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/hooks/use-work-packages', () => ({
  useWorkPackages: (...args: unknown[]) => mockUseWorkPackages(...args),
  useUpdateWorkPackage: () => mockUseUpdateWorkPackage(),
}))

// ─── Shared fixtures ───────────────────────────────────────────────────────────
const today = new Date('2026-05-08')

// Date key must match format() output: format(new Date('2026-05-08'), 'yyyy-MM-dd') = '2026-05-08'
const makeWp = (id: string, startDate: string, overrides: Partial<WorkPackage> = {}): WorkPackage => ({
  id,
  subject: `Task ${id}`,
  description: null,
  projectId: 'prj1',
  typeId: 't1',
  statusId: 's1',
  priorityId: 'p1',
  assigneeId: null,
  startDate,
  dueDate: null,
  storyPoints: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  status: { id: 's1', name: 'Open', color: '#10B981', isClosed: false, position: 1, createdAt: new Date(), updatedAt: new Date() },
  type: { id: 't1', name: 'Task', color: '#6366F1', position: 1, createdAt: new Date(), updatedAt: new Date() },
  ...overrides,
} as WorkPackage)

// ─── WorkPackageCalendarHeader ────────────────────────────────────────────────

describe('WorkPackageCalendarHeader', () => {
  const defaultProps = {
    currentDate: today,
    viewMode: 'month' as CalendarViewMode,
    onViewModeChange: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: month mode shows full month/year label
  it('shows month and year label in month mode', () => {
    render(<WorkPackageCalendarHeader {...defaultProps} />)
    expect(screen.getByText('May 2026')).toBeInTheDocument()
  })

  // ✅ VALID: week mode shows "Week of" label
  it('shows week label in week mode', () => {
    render(<WorkPackageCalendarHeader {...defaultProps} viewMode="week" />)
    expect(screen.getByText(/week of/i)).toBeInTheDocument()
  })

  // ✅ VALID: Today button calls onToday
  it('calls onToday when Today button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendarHeader {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(defaultProps.onToday).toHaveBeenCalledOnce()
  })

  // ✅ VALID: Previous button calls onPrev
  it('calls onPrev when Previous button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendarHeader {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(defaultProps.onPrev).toHaveBeenCalledOnce()
  })

  // ✅ VALID: Next button calls onNext
  it('calls onNext when Next button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendarHeader {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(defaultProps.onNext).toHaveBeenCalledOnce()
  })

  // ✅ VALID: Month button changes view mode
  it('calls onViewModeChange with month when Month button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendarHeader {...defaultProps} viewMode="week" />)
    await user.click(screen.getByRole('button', { name: 'Month' }))
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('month')
  })

  // ✅ VALID: Week button changes view mode
  it('calls onViewModeChange with week when Week button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendarHeader {...defaultProps} viewMode="month" />)
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith('week')
  })
})

// ─── WorkPackageCalendarGrid ───────────────────────────────────────────────────

describe('WorkPackageCalendarGrid', () => {
  // Build 35-day grid for May 2026 calendar view
  // May 1, 2026 is a Friday — startOfWeek(Fri, weekStartsOn:1) = Mon Apr 27
  const may2026Days: Date[] = []
  for (let i = 0; i < 35; i++) {
    const d = new Date('2026-04-27')
    d.setDate(d.getDate() + i)
    may2026Days.push(d)
  }

  const defaultProps = {
    days: may2026Days,
    workPackagesByDate: new Map<string, WorkPackage[]>(),
    viewMode: 'month' as CalendarViewMode,
    currentDate: new Date('2026-05-08'),
    onEventClick: vi.fn(),
    onEventDrop: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders all 7 day-of-week headers
  it('renders Mon through Sun headers', () => {
    render(<WorkPackageCalendarGrid {...defaultProps} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  // ✅ VALID: renders work package pill with correct subject text
  it('renders work package pill with correct subject text', () => {
    const wpMap = new Map<string, WorkPackage[]>([
      ['2026-05-08', [makeWp('wp1', '2026-05-08')]],
    ])
    render(<WorkPackageCalendarGrid {...defaultProps} workPackagesByDate={wpMap} />)
    // Button text is "Task wp1" — accessible name matches button text
    expect(screen.getByRole('button', { name: 'Task wp1' })).toBeInTheDocument()
  })

  // ✅ VALID: shows "+N more" when > 3 WPs in compact cell
  it('shows overflow indicator when more than 3 events in a cell', () => {
    const wpMap = new Map<string, WorkPackage[]>([
      ['2026-05-08', [
        makeWp('wp1', '2026-05-08'),
        makeWp('wp2', '2026-05-08'),
        makeWp('wp3', '2026-05-08'),
        makeWp('wp4', '2026-05-08'),
      ]],
    ])
    render(<WorkPackageCalendarGrid {...defaultProps} workPackagesByDate={wpMap} />)
    expect(screen.getByText('+1 more')).toBeInTheDocument()
  })

  // ✅ VALID: today cell has ring highlight
  it('today cell has ring-2 class', () => {
    const wpMap = new Map<string, WorkPackage[]>()
    render(<WorkPackageCalendarGrid {...defaultProps} workPackagesByDate={wpMap} />)
    const todayRing = document.querySelector('.ring-2')
    expect(todayRing).toBeInTheDocument()
  })

  // ✅ VALID: out-of-month days have bg-gray-50
  it('days outside current month have muted background', () => {
    const wpMap = new Map<string, WorkPackage[]>()
    render(<WorkPackageCalendarGrid {...defaultProps} workPackagesByDate={wpMap} />)
    // April days should have bg-gray-50 (muted)
    const mutedCells = document.querySelectorAll('.bg-gray-50')
    expect(mutedCells.length).toBeGreaterThan(0)
  })

  // ✅ VALID: event click calls onEventClick with correct WP id
  it('calls onEventClick when pill is clicked', async () => {
    const user = userEvent.setup()
    const wpMap = new Map<string, WorkPackage[]>([
      ['2026-05-08', [makeWp('wp1', '2026-05-08')]],
    ])
    render(<WorkPackageCalendarGrid {...defaultProps} workPackagesByDate={wpMap} />)
    await user.click(screen.getByRole('button', { name: 'Task wp1' }))
    expect(defaultProps.onEventClick).toHaveBeenCalledWith('wp1')
  })

  // ✅ VALID: week view shows full day names + date numbers in header
  it('week view renders full day names in header', () => {
    // Build 7 days starting from Mon May 3, 2026
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-05-03')
      d.setDate(d.getDate() + i)
      return d
    })
    render(<WorkPackageCalendarGrid {...defaultProps} days={weekDays} viewMode="week" />)
    // Week header shows "Mon", "Tue", etc.
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })

  // ✅ VALID: week view shows "No events" in empty day columns
  it('week view shows No events in empty day columns', () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date('2026-05-03')
      d.setDate(d.getDate() + i)
      return d
    })
    render(<WorkPackageCalendarGrid {...defaultProps} days={weekDays} viewMode="week" workPackagesByDate={new Map()} />)
    expect(screen.getAllByText(/no events/i).length).toBeGreaterThan(0)
  })
})

// ─── WorkPackageCalendarSkeleton ───────────────────────────────────────────────

describe('WorkPackageCalendarSkeleton', () => {
  // ✅ VALID: renders 7 day-of-week headers
  it('renders Mon through Sun labels', () => {
    render(<WorkPackageCalendarSkeleton />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  // ✅ VALID: renders at least 35 date number skeletons
  it('renders at least 35 calendar grid cells', () => {
    render(<WorkPackageCalendarSkeleton />)
    // 35 cells × 1 date skeleton each = at least 35 animate-pulse elements
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThanOrEqual(35)
  })

  // ✅ VALID: contains animate-pulse elements
  it('contains animated skeleton elements', () => {
    render(<WorkPackageCalendarSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })
})

// ─── WorkPackageCalendarEmptyState ────────────────────────────────────────────

describe('WorkPackageCalendarEmptyState', () => {
  // ✅ VALID: renders SVG illustration
  it('renders SVG illustration', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  // ✅ VALID: renders h3 heading
  it('renders heading', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(screen.getByText('No work packages this month')).toBeInTheDocument()
  })

  // ✅ VALID: renders descriptive sub-text
  it('renders descriptive message', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(screen.getByText(/there are no work packages scheduled for this month/i)).toBeInTheDocument()
  })

  // ✅ VALID: create button calls onCreateFirst when provided
  it('calls onCreateFirst when Create button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateFirst = vi.fn()
    render(<WorkPackageCalendarEmptyState onCreateFirst={onCreateFirst} />)
    await user.click(screen.getByRole('button', { name: /create work package/i }))
    expect(onCreateFirst).toHaveBeenCalledOnce()
  })

  // ✅ VALID: no create button when onCreateFirst not provided
  it('does not render create button when onCreateFirst is not provided', () => {
    render(<WorkPackageCalendarEmptyState />)
    expect(screen.queryByRole('button', { name: /create work package/i })).not.toBeInTheDocument()
  })
})

// ─── WorkPackageCalendar integration ──────────────────────────────────────────

describe('WorkPackageCalendar', () => {
  // The useWorkPackages mock returns the direct response (not { workPackages: ... })
  const setupMock = (overrides = {}) => {
    mockUseWorkPackages.mockReturnValue({
      workPackages: { data: [], isLoading: false, isError: false },
      ...overrides,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMock()
  })

  // ✅ VALID: renders calendar header with month label
  it('renders calendar header with month label', () => {
    render(<WorkPackageCalendar projectId="prj1" />)
    expect(screen.getByText('May 2026')).toBeInTheDocument()
  })

  // ✅ VALID: shows Loading... when isLoading is true
  it('shows Loading indicator when isLoading is true', () => {
    mockUseWorkPackages.mockReturnValue({
      workPackages: { data: [], isLoading: true, isError: false },
    })
    render(<WorkPackageCalendar projectId="prj1" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  // ✅ VALID: shows error message when isError is true
  it('shows error message when isError is true', () => {
    mockUseWorkPackages.mockReturnValue({
      workPackages: { data: [], isLoading: false, isError: true },
    })
    render(<WorkPackageCalendar projectId="prj1" />)
    expect(screen.getByText(/failed to load work packages/i)).toBeInTheDocument()
  })

  // ✅ VALID: switches to week view when Week button is clicked
  it('switches to week view when Week button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageCalendar projectId="prj1" />)
    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(screen.getByText(/week of/i)).toBeInTheDocument()
  })

  // ✅ VALID: renders work package pills on the calendar grid
  it('renders work package pills in correct date cells', () => {
    mockUseWorkPackages.mockReturnValue({
      workPackages: {
        data: [makeWp('wp1', '2026-05-08')],
        isLoading: false,
        isError: false,
      },
    })
    render(<WorkPackageCalendar projectId="prj1" />)
    expect(screen.getByRole('button', { name: 'Task wp1' })).toBeInTheDocument()
  })
})
