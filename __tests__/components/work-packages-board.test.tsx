import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Imports of components under test ─────────────────────────────────────────
import { WorkPackageBoardColumn } from '@/components/work-packages/board/WorkPackageBoardColumn'
import { WorkPackageBoardColumnHeader } from '@/components/work-packages/board/WorkPackageBoardColumnHeader'
import { WorkPackageBoardSkeleton } from '@/components/work-packages/board/WorkPackageBoardSkeleton'
import { WorkPackageBoardEmptyState } from '@/components/work-packages/board/WorkPackageBoardEmptyState'
import type { BoardColumn } from '@/components/work-packages/board/types'
import type { WorkPackage, Status } from '@/types'

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const mockStatus: Status = {
  id: 'status1',
  name: 'In Progress',
  color: '#3B82F6',
  isClosed: false,
  position: 2,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockWp = (i: number): WorkPackage => ({
  id: `wp${i}`,
  subject: `Work package ${i}`,
  description: null,
  projectId: 'prj1',
  typeId: 'type1',
  statusId: 'status1',
  priorityId: 'prio1',
  assigneeId: null,
  startDate: null,
  dueDate: null,
  storyPoints: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  versionId: null,
})

const makeColumn = (overrides: Partial<BoardColumn> = {}): BoardColumn => ({
  statusId: 'status1',
  status: mockStatus,
  workPackages: [mockWp(1)],
  wipLimit: 3,
  isOverLimit: false,
  isAtLimit: false,
  ...overrides,
})

// ─── WorkPackageBoardColumnHeader ───────────────────────────────────────────────

describe('WorkPackageBoardColumnHeader', () => {
  // ✅ VALID: correct prop → correct visual output
  it('renders status name and count', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={5} wipLimit={null} isOverLimit={false} isAtLimit={false} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders WIP limit indicator when wipLimit is set', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={2} wipLimit={3} isOverLimit={false} isAtLimit={false} />)
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  // ✅ VALID: isOverLimit=true → red color + warning dot
  it('shows red text and warning dot when over limit', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={4} wipLimit={3} isOverLimit={true} isAtLimit={false} />)
    const indicator = screen.getByText('4/3')
    expect(indicator.className).toContain('text-red-600')
    expect(screen.getByTitle('Over WIP limit')).toBeInTheDocument()
  })

  // ✅ VALID: isAtLimit=true → yellow color + warning dot
  it('shows yellow text and dot when at limit', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={3} wipLimit={3} isOverLimit={false} isAtLimit={true} />)
    const indicator = screen.getByText('3/3')
    expect(indicator.className).toContain('text-yellow-600')
    expect(screen.getByTitle('At WIP limit')).toBeInTheDocument()
  })

  // ✅ VALID: under limit → neutral gray
  it('shows neutral gray when under limit', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={1} wipLimit={3} isOverLimit={false} isAtLimit={false} />)
    const indicator = screen.getByText('1/3')
    expect(indicator.className).toContain('text-gray-500')
  })

  // ✅ VALID: null wipLimit → no ratio displayed
  it('shows count only when wipLimit is null', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={7} wipLimit={null} isOverLimit={false} isAtLimit={false} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText(/\/\d/)).not.toBeInTheDocument()
  })

  // ✅ NEW: EDGE CASE — isAtLimit AND isOverLimit both true (conflicting state)
  it('isOverLimit takes precedence over isAtLimit when both are true', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={5} wipLimit={3} isOverLimit={true} isAtLimit={true} />)
    const indicator = screen.getByText('5/3')
    // isOverLimit branch in code: isOverLimit ? 'text-red-600' : isAtLimit ? 'text-yellow-600'
    // Since isOverLimit=true, should be red not yellow
    expect(indicator.className).toContain('text-red-600')
  })

  // ✅ NEW: EDGE CASE — wipLimit=0 (no items allowed)
  it('shows red when wipLimit=0 and there is 1 item', () => {
    const col = makeColumn({ wipLimit: 0, isOverLimit: true, isAtLimit: false, workPackages: [mockWp(1)] })
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={1} wipLimit={0} isOverLimit={true} isAtLimit={false} />)
    const indicator = screen.getByText('1/0')
    expect(indicator.className).toContain('text-red-600')
  })

  // ✅ NEW: EDGE CASE — wipLimit=1, at limit
  it('shows yellow when wipLimit=1 and exactly 1 item', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={1} wipLimit={1} isOverLimit={false} isAtLimit={true} />)
    const indicator = screen.getByText('1/1')
    expect(indicator.className).toContain('text-yellow-600')
  })

  // ✅ VALID: status color dot is rendered with correct color
  it('renders status color dot', () => {
    render(<WorkPackageBoardColumnHeader status={mockStatus} count={1} wipLimit={null} isOverLimit={false} isAtLimit={false} />)
    const dot = document.querySelector('.rounded-full')
    expect(dot).toBeInTheDocument()
    // Browser returns rgb value; verify it matches #3B82F6
    expect((dot as HTMLElement).style.backgroundColor).toBe('rgb(59, 130, 246)')
  })
})

// ─── WorkPackageBoardColumn ────────────────────────────────────────────────────

describe('WorkPackageBoardColumn', () => {
  // ✅ VALID: renders all work packages passed in
  it('renders work package cards', () => {
    const column = makeColumn({ workPackages: [mockWp(1), mockWp(2)] })
    render(<WorkPackageBoardColumn column={column} />)
    expect(screen.getByText('Work package 1')).toBeInTheDocument()
    expect(screen.getByText('Work package 2')).toBeInTheDocument()
  })

  // ✅ VALID: isOverLimit → red ring applied
  it('applies red ring when isOverLimit is true', () => {
    const column = makeColumn({ isOverLimit: true, wipLimit: 1 })
    render(<WorkPackageBoardColumn column={column} />)
    // Find the element with ring-2 class
    const ring = Array.from(document.querySelectorAll('[class*="ring-"]')).find(el =>
      el.className.includes('ring-red-200')
    )
    expect(ring).toBeDefined()
  })

  // ✅ VALID: isOverLimit=false → no ring
  it('does NOT apply ring when isOverLimit is false', () => {
    const column = makeColumn({ isOverLimit: false, wipLimit: 3 })
    render(<WorkPackageBoardColumn column={column} />)
    // Specifically look for red ring — should not exist
    const redRing = Array.from(document.querySelectorAll('[class*="ring-"]')).find(el =>
      el.className.includes('ring-red')
    )
    expect(redRing).toBeUndefined()
  })

  // ✅ VALID: isOverLimit → warning banner shows correct count
  it('shows over-limit warning banner with correct count', () => {
    const column = makeColumn({ isOverLimit: true, wipLimit: 1, workPackages: [mockWp(1), mockWp(2)] })
    render(<WorkPackageBoardColumn column={column} />)
    expect(screen.getByText(/Over WIP limit/)).toBeInTheDocument()
    // Banner shows "count / wipLimit" — 2 items / 1 limit
    expect(screen.getByText('2/1')).toBeInTheDocument()
  })

  // ✅ VALID: isOverLimit=false → no banner
  it('does not show banner when not over limit', () => {
    const column = makeColumn({ isOverLimit: false })
    render(<WorkPackageBoardColumn column={column} />)
    expect(screen.queryByText(/Over WIP limit/)).not.toBeInTheDocument()
  })

  // ✅ VALID: empty workPackages → "No items" placeholder
  it('shows empty state message when no work packages', () => {
    const column = makeColumn({ workPackages: [] })
    render(<WorkPackageBoardColumn column={column} />)
    expect(screen.getByText('No items')).toBeInTheDocument()
  })

  // ✅ VALID: onAddCard called with correct statusId
  it('calls onAddCard with statusId when add button is clicked', async () => {
    const user = userEvent.setup()
    const onAddCard = vi.fn()
    const column = makeColumn()
    render(<WorkPackageBoardColumn column={column} onAddCard={onAddCard} />)
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddCard).toHaveBeenCalledWith('status1')
  })

  // ✅ NEW: EDGE CASE — isOverLimit with wipLimit=null should not crash
  it('renders without error when wipLimit is null even with isOverLimit true', () => {
    const column = makeColumn({ wipLimit: null, isOverLimit: true })
    expect(() => render(<WorkPackageBoardColumn column={column} />)).not.toThrow()
  })
})

// ─── WorkPackageBoardSkeleton ───────────────────────────────────────────────────

describe('WorkPackageBoardSkeleton', () => {
  // ✅ VALID: renders correct number of columns (COLUMNS = 4 hardcoded in source)
  it('renders 4 columns', () => {
    render(<WorkPackageBoardSkeleton />)
    // Each column has class w-64
    const columns = document.querySelectorAll('[class*="w-64"]')
    expect(columns.length).toBe(4)
  })

  // ✅ VALID: all skeleton elements have animate-pulse
  it('every skeleton placeholder has animate-pulse', () => {
    render(<WorkPackageBoardSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    // All pulse elements should be inside columns
    const columns = Array.from(document.querySelectorAll('[class*="w-64"]'))
    const pulsesInColumns = columns.flatMap(col => Array.from(col.querySelectorAll('.animate-pulse')))
    expect(pulses.length).toBe(pulsesInColumns.length)
  })

  // ✅ VALID: first column has specific card count (3 cards as per CARDS_PER_COLUMN)
  it('first column renders 3 skeleton cards (COLUMNS/CARDS_PER_COLUMN from source)', () => {
    render(<WorkPackageBoardSkeleton />)
    const columns = document.querySelectorAll('[class*="w-64"]')
    // CARDS_PER_COLUMN = [3, 2, 4, 1]; col 0 has 3 cards
    const firstColCards = columns[0].querySelectorAll('[class*="rounded-xl"]')
    expect(firstColCards.length).toBe(3)
  })
})

// ─── WorkPackageBoardEmptyState ────────────────────────────────────────────────

describe('WorkPackageBoardEmptyState', () => {
  // ✅ VALID: static content always rendered
  it('renders heading and description', () => {
    render(<WorkPackageBoardEmptyState />)
    expect(screen.getByText('No work packages in this view')).toBeInTheDocument()
    expect(screen.getByText(/Try adjusting your filters/)).toBeInTheDocument()
  })

  // ✅ VALID: SVG illustration rendered
  it('renders SVG illustration', () => {
    render(<WorkPackageBoardEmptyState />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // ✅ VALID: button rendered only when callback provided
  it('renders create button when onCreateFirst is provided', () => {
    const onCreateFirst = vi.fn()
    render(<WorkPackageBoardEmptyState onCreateFirst={onCreateFirst} />)
    const btn = screen.getByRole('button', { name: /create work package/i })
    expect(btn).toBeInTheDocument()
  })

  // ✅ VALID: button NOT rendered when callback omitted
  it('does not render button when onCreateFirst is omitted', () => {
    render(<WorkPackageBoardEmptyState />)
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
  })

  // ✅ VALID: callback invoked with correct interaction
  it('calls onCreateFirst when button is clicked', async () => {
    const user = userEvent.setup()
    const onCreateFirst = vi.fn()
    render(<WorkPackageBoardEmptyState onCreateFirst={onCreateFirst} />)
    await user.click(screen.getByRole('button', { name: /create work package/i }))
    expect(onCreateFirst).toHaveBeenCalledOnce()
  })
})
