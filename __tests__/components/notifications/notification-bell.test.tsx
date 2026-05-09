import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ─── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useNotifications', () => ({
  useUnreadCount: vi.fn(),
  useNotifications: vi.fn(),
}))

vi.mock('@/hooks/useNotificationMutations', () => ({
  useMarkNotificationAsRead: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useUnreadCount, useNotifications } from '@/hooks/useNotifications'

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  reason: 'mentioned' as const,
  projectId: 'proj-1',
  projectName: 'Test Project',
  resourceType: 'work_package' as const,
  resourceId: 'wp-1',
  resourceSubject: 'Test Work Package',
  actorId: 'actor-1',
  actorName: 'John Doe',
  read: false,
  readAt: null,
  createdAt: new Date().toISOString(),
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: renders bell icon
  it('renders bell icon', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 0 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    expect(bellButton).toBeInTheDocument()
    const svg = bellButton.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // ✅ VALID: badge is hidden when count is 0
  it('hides badge when unread count is zero', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 0 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const badges = document.querySelectorAll('.bg-red-500')
    expect(badges.length).toBe(0)
  })

  // ✅ VALID: badge shows actual count when count <= 99
  it('shows badge with count when unread count is between 1 and 99', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 5,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [mockNotification], meta: { page: 1, perPage: 20, total: 1, totalPages: 1, unreadCount: 5 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const badge = screen.getByText('5')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-red-500')
  })

  // ✅ VALID: badge shows "99+" when count exceeds 99
  it('shows "99+" when unread count exceeds 99', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 150,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 150 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const badge = screen.getByText('99+')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-red-500')
  })

  // ✅ VALID: badge is hidden while loading
  it('hides badge while loading', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 10,
      isLoading: true,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    render(<NotificationBell />)

    const badgeInDocument = document.querySelector('.bg-red-500')
    expect(badgeInDocument).not.toBeInTheDocument()
  })

  // ✅ VALID: aria-label includes unread count
  it('has aria-label that includes unread count when present', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 7,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 7 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /notifications \(\d+ unread\)/i })
    expect(bellButton).toBeInTheDocument()
  })

  // ✅ VALID: aria-label does not include unread count when zero
  it('has aria-label without unread count when there are no notifications', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 0 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /^Notifications$/i })
    expect(bellButton).toBeInTheDocument()
  })

  // ✅ VALID: bell has correct hover styling classes
  it('bell button has hover background class', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0, unreadCount: 0 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /^Notifications$/i })
    expect(bellButton.className).toContain('hover:bg-gray-100')
  })

  // ✅ VALID: badge is positioned absolutely relative to parent
  it('badge is absolutely positioned relative to button', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 3,
      isLoading: false,
    })
    vi.mocked(useNotifications).mockReturnValue({
      data: { data: { notifications: [mockNotification], meta: { page: 1, perPage: 20, total: 1, totalPages: 1, unreadCount: 3 } } },
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const badge = screen.getByText('3')
    expect(badge.parentElement).toBeInTheDocument()
    expect(badge.className).toContain('absolute')
  })
})
