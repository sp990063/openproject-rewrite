import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock sub-widgets that MyPageWidget renders ────────────────────────────────
vi.mock('@/components/my-page/widgets/AssignedWorkPackagesWidget', () => ({
  AssignedWorkPackagesWidget: () => <div data-testid="assigned-wp-widget">Assigned Work Packages Content</div>,
}))

vi.mock('@/components/my-page/widgets/TimeEntriesWidget', () => ({
  TimeEntriesWidget: () => <div data-testid="time-entries-widget">Time Entries Content</div>,
}))

vi.mock('@/components/my-page/widgets/UpcomingMeetingsWidget', () => ({
  UpcomingMeetingsWidget: () => <div data-testid="upcoming-meetings-widget">Upcoming Meetings Content</div>,
}))

// ─── Import component under test ─────────────────────────────────────────────
import { MyPageWidget } from '@/components/my-page/MyPageWidget'
import type { MyPageWidget as MyPageWidgetType } from '@/hooks/useMyPage'
import type { WidgetType } from '@/types/my-page'

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const mockWidget = (overrides: Partial<MyPageWidgetType> = {}): MyPageWidgetType => ({
  id: 'widget1',
  userId: 'user1',
  type: 'assigned_work_packages' as WidgetType,
  config: {},
  position: { x: 0, y: 0, w: 1, h: 1 },
  collapsed: false,
  ...overrides,
})

// ─── MyPageWidget ────────────────────────────────────────────────────────────

describe('MyPageWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: renders widget with title for assigned_work_packages type
  it('renders widget with correct title for assigned_work_packages type', () => {
    const widget = mockWidget({ type: 'assigned_work_packages' })
    render(<MyPageWidget widget={widget} />)

    expect(screen.getByText('Assigned Work Packages')).toBeInTheDocument()
  })

  // ✅ VALID: renders correct title for time_entries_this_week type
  it('renders correct title for time_entries_this_week type', () => {
    const widget = mockWidget({ type: 'time_entries_this_week' })
    render(<MyPageWidget widget={widget} />)

    expect(screen.getByText('Time Entries This Week')).toBeInTheDocument()
  })

  // ✅ VALID: renders correct title for upcoming_meetings type
  it('renders correct title for upcoming_meetings type', () => {
    const widget = mockWidget({ type: 'upcoming_meetings' })
    render(<MyPageWidget widget={widget} />)

    expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument()
  })

  // ✅ VALID: shows collapse toggle button when not collapsed
  it('shows collapse toggle button when widget is not collapsed', () => {
    const widget = mockWidget({ collapsed: false })
    render(<MyPageWidget widget={widget} />)

    const collapseButton = screen.getByRole('button', { name: /collapse/i })
    expect(collapseButton).toBeInTheDocument()
  })

  // ✅ VALID: shows expand toggle when collapsed
  it('shows expand toggle when widget is collapsed', () => {
    const widget = mockWidget({ collapsed: true })
    render(<MyPageWidget widget={widget} />)

    const expandButton = screen.getByRole('button', { name: /expand/i })
    expect(expandButton).toBeInTheDocument()
  })

  // ✅ VALID: clicking collapse toggles to expanded state
  it('clicking expand button expands the widget', async () => {
    const user = userEvent.setup()
    const widget = mockWidget({ collapsed: true })
    render(<MyPageWidget widget={widget} />)

    // Initially collapsed - should show expand button
    expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument()

    // Click to expand
    await user.click(screen.getByRole('button', { name: /expand/i }))

    // Now should show collapse button
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument()
  })

  // ✅ VALID: shows edit controls in editMode
  it('shows edit controls when editMode is true', () => {
    const widget = mockWidget({ type: 'assigned_work_packages' })
    render(<MyPageWidget widget={widget} editMode={true} />)

    // Should show remove button in edit mode
    expect(screen.getByText(/✕ remove/i)).toBeInTheDocument()
  })

  // ✅ VALID: hides edit controls when editMode is false
  it('hides edit controls when editMode is false', () => {
    const widget = mockWidget({ type: 'assigned_work_packages' })
    render(<MyPageWidget widget={widget} editMode={false} />)

    // Remove button should not be visible
    expect(screen.queryByText(/remove/i)).not.toBeInTheDocument()
  })

  // ✅ VALID: content is shown when not collapsed
  it('renders widget content when not collapsed', () => {
    const widget = mockWidget({ type: 'assigned_work_packages' })
    render(<MyPageWidget widget={widget} />)

    // The mocked widget content should be visible
    expect(screen.getByTestId('assigned-wp-widget')).toBeInTheDocument()
  })

  // ✅ VALID: content is hidden when collapsed
  it('hides content when widget is collapsed', () => {
    const widget = mockWidget({ collapsed: true })
    render(<MyPageWidget widget={widget} />)

    // The mocked widget content should NOT be visible
    expect(screen.queryByTestId('assigned-wp-widget')).not.toBeInTheDocument()
  })

  // ✅ VALID: uses widget type as fallback title for unknown types
  it('uses widget type as fallback title for unknown types', () => {
    const widget = mockWidget({ type: 'news' as WidgetType })
    render(<MyPageWidget widget={widget} />)

    // Should show "News" (formatted from type)
    expect(screen.getByText('News')).toBeInTheDocument()
  })

  // ✅ VALID: widget has proper container styling
  it('widget container has rounded border and shadow', () => {
    const widget = mockWidget()
    const { container } = render(<MyPageWidget widget={widget} />)

    const outerDiv = container.querySelector('.bg-white')
    expect(outerDiv).toBeInTheDocument()
    expect(outerDiv?.className).toContain('rounded-lg')
    expect(outerDiv?.className).toContain('border')
    expect(outerDiv?.className).toContain('shadow-sm')
  })

  // ✅ VALID: collapse chevron has rotation class when collapsed
  it('collapse chevron rotates when widget is collapsed', () => {
    const widget = mockWidget({ collapsed: true })
    const { container } = render(<MyPageWidget widget={widget} />)

    // The chevron should have -rotate-90 class when collapsed
    // SVG className is SVGAnimatedString, use className.baseVal
    const svg = container.querySelector('svg')
    expect(svg?.className?.baseVal ?? '').toContain('rotate-90')
  })

  // ✅ VALID: collapse chevron does not rotate when expanded
  it('collapse chevron does not rotate when widget is expanded', () => {
    const widget = mockWidget({ collapsed: false })
    const { container } = render(<MyPageWidget widget={widget} />)

    // The chevron should NOT have -rotate-90 class when expanded
    const svg = container.querySelector('svg')
    expect(svg?.className).not.toContain('-rotate-90')
  })

  // ✅ VALID: renders correct title for watched_work_packages type
  it('renders correct title for watched_work_packages type', () => {
    const widget = mockWidget({ type: 'watched_work_packages' })
    render(<MyPageWidget widget={widget} />)

    expect(screen.getByText('Watched Work Packages')).toBeInTheDocument()
  })

  // ✅ VALID: renders recent_projects widget type
  it('renders recent_projects widget type', () => {
    const widget = mockWidget({ type: 'recent_projects' })
    render(<MyPageWidget widget={widget} />)

    expect(screen.getByText('Recent Projects')).toBeInTheDocument()
  })
})
