import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock next/router ─────────────────────────────────────────────────────────
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// ─── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
  useUnreadCount: vi.fn(),
}))

vi.mock('@/hooks/useNotificationMutations', () => ({
  useMarkNotificationAsRead: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useMarkAllNotificationsRead: vi.fn(),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import type { Notification } from '@/types/notification'
import { useNotifications } from '@/hooks/useNotifications'
import { useMarkAllNotificationsRead } from '@/hooks/useNotificationMutations'

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const mockNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif1',
  userId: 'user1',
  reason: 'mentioned',
  projectId: 'prj1',
  projectName: 'Test Project',
  resourceType: 'work_package',
  resourceId: 'wp1',
  resourceSubject: 'Implement login feature',
  actorId: 'actor1',
  actorName: 'John Doe',
  read: false,
  readAt: null,
  createdAt: new Date('2026-05-01T10:00:00Z').toISOString(),
  ...overrides,
})

const mockNotificationsResponse = (notifications: Notification[]) => ({
  data: notifications,
  total: notifications.length,
  page: 1,
  perPage: 20,
})

// ─── NotificationCenter ───────────────────────────────────────────────────────

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: bell icon is rendered
  it('renders bell icon button', () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([]),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    expect(bellButton).toBeInTheDocument()
  })

  // ✅ VALID: clicking bell opens dropdown
  it('opens dropdown when bell is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([]),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    await user.click(bellButton)

    // Dropdown should now show the panel
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  // ✅ VALID: shows notification list when open and has notifications
  it('shows notification list when open with notifications', async () => {
    const user = userEvent.setup()
    const notifications = [
      mockNotification({ id: 'n1', actorName: 'Alice', resourceSubject: 'Task 1' }),
      mockNotification({ id: 'n2', actorName: 'Bob', resourceSubject: 'Task 2' }),
    ]
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse(notifications),
      isLoading: false,
    } as any)
    vi.mocked(useMarkAllNotificationsRead).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<NotificationCenter />)

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /notifications/i }))

    // Should show both notifications
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  // ✅ VALID: shows unread badge when unread count > 0
  it('shows unread badge when there are unread notifications', () => {
    const notifications = [
      mockNotification({ id: 'n1', read: false }),
      mockNotification({ id: 'n2', read: false }),
    ]
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse(notifications),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    // Badge should show count
    const badge = screen.getByText('2')
    expect(badge).toBeInTheDocument()
  })

  // ✅ VALID: badge shows "9+" when unread count > 9
  it('shows 9+ badge when unread count exceeds 9', () => {
    const notifications = Array.from({ length: 12 }, (_, i) =>
      mockNotification({ id: `n${i}`, read: false })
    )
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse(notifications),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    const badge = screen.getByText('9+')
    expect(badge).toBeInTheDocument()
  })

  // ✅ VALID: "Mark all read" button appears when unread > 0
  it('shows "Mark all read" button when unread notifications exist', async () => {
    const user = userEvent.setup()
    const notifications = [
      mockNotification({ id: 'n1', read: false }),
      mockNotification({ id: 'n2', read: true }),
    ]
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse(notifications),
      isLoading: false,
    } as any)
    vi.mocked(useMarkAllNotificationsRead).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<NotificationCenter />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument()
  })

  // ✅ VALID: "Mark all read" button calls markAllRead mutation
  it('calls markAllRead when "Mark all read" button is clicked', async () => {
    const user = userEvent.setup()
    const markAllReadMock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([mockNotification({ read: false })]),
      isLoading: false,
    } as any)
    vi.mocked(useMarkAllNotificationsRead).mockReturnValue({
      mutateAsync: markAllReadMock,
      isPending: false,
    } as any)

    render(<NotificationCenter />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(screen.getByRole('button', { name: /mark all read/i }))

    expect(markAllReadMock).toHaveBeenCalledTimes(1)
  })

  // ✅ VALID: empty state when no notifications
  it('shows empty state when no notifications', async () => {
    const user = userEvent.setup()
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([]),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
  })

  // ✅ VALID: loading state is shown when isLoading=true
  it('shows loading state while fetching', async () => {
    const user = userEvent.setup()
    vi.mocked(useNotifications).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    render(<NotificationCenter />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  // ✅ VALID: clicking outside closes dropdown
  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([]),
      isLoading: false,
    } as any)

    render(
      <div>
        <NotificationCenter />
        <div data-testid="outside">Outside</div>
      </div>
    )

    // Open dropdown
    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    // Click outside
    await user.click(screen.getByTestId('outside'))

    // Dropdown should be closed (Notifications heading should not be visible)
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
  })

  // ✅ VALID: "View all notifications" link exists when dropdown is open
  it('shows "View all notifications" link at bottom of dropdown', async () => {
    const user = userEvent.setup()
    vi.mocked(useNotifications).mockReturnValue({
      data: mockNotificationsResponse([]),
      isLoading: false,
    } as any)

    render(<NotificationCenter />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    const viewAllLink = screen.getByRole('link', { name: /view all notifications/i })
    expect(viewAllLink).toBeInTheDocument()
    expect(viewAllLink).toHaveAttribute('href', '/notifications')
  })
})
