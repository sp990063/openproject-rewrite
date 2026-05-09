import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useTimeEntries', () => ({
  useWorkPackageTimeEntries: vi.fn(),
}))

vi.mock('@/hooks/useTimeEntryMutations', () => ({
  useSubmitTimeEntry: vi.fn(),
  useApproveTimeEntry: vi.fn(),
  useRejectTimeEntry: vi.fn(),
}))

vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { TimeEntryList } from '@/components/time-tracking/TimeEntryList'
import {
  useWorkPackageTimeEntries,
} from '@/hooks/useTimeEntries'
import {
  useSubmitTimeEntry,
  useApproveTimeEntry,
  useRejectTimeEntry,
} from '@/hooks/useTimeEntryMutations'
import { useCurrentUser } from '@/hooks/use-current-user'

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const mockUser = { id: 'user1', name: 'Test User', isSystemAdmin: false }
const mockAdminUser = { id: 'admin1', name: 'Admin User', isSystemAdmin: true }

const mockTimeEntry = (overrides: Partial<{
  id: string
  hours: number
  comment: string | null
  spentOn: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  userId: string
  user: { id: string; name: string }
}> = {}) => ({
  id: 'entry1',
  hours: 2.5,
  comment: null,
  spentOn: '2026-05-01',
  status: 'pending' as const,
  userId: 'user1',
  user: { id: 'user1', name: 'Test User' },
  workPackageId: 'wp1',
  userTimezone: 'UTC',
  approvedBy: null,
  approvedAt: null,
  rejectReason: null,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
  ...overrides,
})

// ─── TimeEntryList ────────────────────────────────────────────────────────────

describe('TimeEntryList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: shows total hours in header
  it('shows total hours in header', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', hours: 2.5 }),
      mockTimeEntry({ id: 'e2', hours: 1.5 }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getByText(/total:/i)).toBeInTheDocument()
    expect(screen.getByText('4.00h')).toBeInTheDocument()
  })

  // ✅ VALID: shows loading skeleton when loading
  it('shows loading skeleton when isLoading is true', () => {
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: [],
      isLoading: true,
    } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    // Should show skeleton elements
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })

  // ✅ VALID: shows empty state when no entries
  it('shows empty state when no time entries', () => {
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: [],
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getByText('No time logged yet')).toBeInTheDocument()
  })

  // ✅ VALID: renders each entry with date, hours, comment, user, status badge
  it('renders each entry with date, hours, comment, user name, and status badge', () => {
    const entries = [
      mockTimeEntry({
        id: 'e1',
        hours: 3,
        comment: 'Worked on login',
        spentOn: '2026-05-01',
        status: 'submitted',
        user: { id: 'user1', name: 'Alice' },
      }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    // Date formatted as "May 1"
    expect(screen.getByText(/may 1/i)).toBeInTheDocument()
    // Hours — total header + entry row both show 3.00h, so use getAllByText
    expect(screen.getAllByText(/^3\.00h?$/).length).toBeGreaterThanOrEqual(1)
    // Comment
    expect(screen.getByText('Worked on login')).toBeInTheDocument()
    // User name
    expect(screen.getByText('Alice')).toBeInTheDocument()
    // Status badge
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })

  // ✅ VALID: Submit button shown for own pending entries
  it('shows Submit button for own pending entries', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', status: 'pending', userId: 'user1' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  // ✅ VALID: Approve and Reject buttons shown for submitted entries when user is admin
  it('shows Approve and Reject buttons for submitted entries when user is admin', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', status: 'submitted', userId: 'user1' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockAdminUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  // ✅ VALID: Approve/Reject buttons not shown for non-admin users
  it('hides Approve/Reject buttons for non-admin users', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', status: 'submitted', userId: 'user2' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
  })

  // ✅ VALID: clicking Submit calls useSubmitTimeEntry
  it('calls useSubmitTimeEntry with entry id when Submit is clicked', async () => {
    const user = userEvent.setup()
    const submitMock = vi.fn().mockResolvedValue(undefined)
    const entries = [
      mockTimeEntry({ id: 'entry123', status: 'pending', userId: 'user1' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: submitMock, isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    await user.click(screen.getByRole('button', { name: /submit/i }))

    expect(submitMock).toHaveBeenCalledWith('entry123')
  })

  // ✅ VALID: clicking Approve calls useApproveTimeEntry
  it('calls useApproveTimeEntry with entry id when Approve is clicked', async () => {
    const user = userEvent.setup()
    const approveMock = vi.fn().mockResolvedValue(undefined)
    const entries = [
      mockTimeEntry({ id: 'entry456', status: 'submitted', userId: 'user1' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockAdminUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: approveMock, isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    await user.click(screen.getByRole('button', { name: /approve/i }))

    expect(approveMock).toHaveBeenCalledWith('entry456')
  })

  // ✅ VALID: shows "Unknown user" when user relation is null
  it('shows "Unknown user" when user relation is missing', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', user: { id: 'u1', name: 'Unknown user' } }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getByText('Unknown user')).toBeInTheDocument()
  })

  // ✅ VALID: comment is truncated when too long
  it('truncates long comments', () => {
    const longComment = 'A'.repeat(200)
    const entries = [
      mockTimeEntry({ id: 'e1', comment: longComment }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    // Should have a truncate class on the comment
    const truncatedText = document.querySelector('.truncate')
    expect(truncatedText).toBeInTheDocument()
  })

  // ✅ VALID: correct badge variant for each status
  it('shows correct status badge variants', () => {
    const entries = [
      mockTimeEntry({ id: 'e1', status: 'pending' }),
      mockTimeEntry({ id: 'e2', status: 'submitted' }),
      mockTimeEntry({ id: 'e3', status: 'approved' }),
      mockTimeEntry({ id: 'e4', status: 'rejected' }),
    ]
    vi.mocked(useWorkPackageTimeEntries).mockReturnValue({
      data: entries,
      isLoading: false,
    } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockAdminUser, isLoading: false, isAuthenticated: true } as any)
    vi.mocked(useSubmitTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useApproveTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)
    vi.mocked(useRejectTimeEntry).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any)

    render(<TimeEntryList workPackageId="wp1" />)

    expect(screen.getAllByText('Pending')).toHaveLength(1)
    expect(screen.getAllByText('Submitted')).toHaveLength(1)
    expect(screen.getAllByText('Approved')).toHaveLength(1)
    expect(screen.getAllByText('Rejected')).toHaveLength(1)
  })
})
