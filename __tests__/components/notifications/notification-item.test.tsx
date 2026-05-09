import { describe, it, expect, vi } from 'vitest'
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
vi.mock('@/hooks/useNotificationMutations', () => ({
  useMarkNotificationAsRead: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { NotificationItem } from '@/components/notifications/NotificationItem'
import type { Notification } from '@/types/notification'

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

// ─── NotificationItem ─────────────────────────────────────────────────────────

describe('NotificationItem', () => {
  // ✅ VALID: renders actor name and notification text
  it('renders actor name and notification text', () => {
    const notification = mockNotification({
      actorName: 'Alice Smith',
      reason: 'commented',
      resourceSubject: 'Bug fix task',
    })
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText(/commented on/)).toBeInTheDocument()
    expect(screen.getByText('Bug fix task')).toBeInTheDocument()
  })

  // ✅ VALID: shows unread dot for unread notifications
  it('shows unread blue dot for unread notifications', () => {
    const notification = mockNotification({ read: false })
    const { container } = render(<NotificationItem notification={notification} />)

    // The blue dot is a span with the bg-blue-500 class
    const dot = container.querySelector('.bg-blue-500')
    expect(dot).toBeInTheDocument()
  })

  // ✅ VALID: hides unread dot for read notifications
  it('hides unread dot for read notifications', () => {
    const notification = mockNotification({ read: true })
    const { container } = render(<NotificationItem notification={notification} />)

    // The read notification should NOT have a blue dot
    const dot = container.querySelector('.bg-blue-500')
    expect(dot).not.toBeInTheDocument()
  })

  // ✅ VALID: shows correct icon for different reasons
  it('shows different icons for different reasons', () => {
    const { rerender } = render(<NotificationItem notification={mockNotification({ reason: 'mentioned' })} />)
    expect(screen.getByText('💬')).toBeInTheDocument()

    rerender(<NotificationItem notification={mockNotification({ reason: 'assigned' })} />)
    expect(screen.getByText('📋')).toBeInTheDocument()

    rerender(<NotificationItem notification={mockNotification({ reason: 'deleted' })} />)
    expect(screen.getByText('🗑️')).toBeInTheDocument()

    rerender(<NotificationItem notification={mockNotification({ reason: 'watched' })} />)
    expect(screen.getByText('👁️')).toBeInTheDocument()
  })

  // ✅ VALID: shows relative time using date-fns formatDistanceToNow
  it('shows relative time', () => {
    const recentDate = new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 minutes ago
    const notification = mockNotification({ createdAt: recentDate })
    render(<NotificationItem notification={notification} />)

    // Should show something like "5 minutes ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  // ✅ VALID: shows project name in meta line
  it('shows project name', () => {
    const notification = mockNotification({ projectName: 'My Awesome Project' })
    render(<NotificationItem notification={notification} />)
    expect(screen.getByText('My Awesome Project')).toBeInTheDocument()
  })

  // ✅ VALID: read notifications do not have blue background class
  it('read notifications do not have blue background', () => {
    const notification = mockNotification({ read: true })
    const { container } = render(<NotificationItem notification={notification} />)

    // Should NOT have bg-blue-50 class
    const blueBg = container.querySelector('.bg-blue-50')
    expect(blueBg).not.toBeInTheDocument()
  })

  // ✅ VALID: unread notifications have blue background
  it('unread notifications have blue background', () => {
    const notification = mockNotification({ read: false })
    const { container } = render(<NotificationItem notification={notification} />)

    // Should have bg-blue-50 class
    const blueBg = container.querySelector('.bg-blue-50')
    expect(blueBg).toBeInTheDocument()
  })

  // ✅ VALID: is a clickable div
  it('is a clickable div with cursor-pointer', () => {
    const notification = mockNotification()
    const { container } = render(<NotificationItem notification={notification} />)

    const clickableDiv = container.querySelector('.cursor-pointer')
    expect(clickableDiv).toBeInTheDocument()
  })

  // ✅ VALID: uses correct icons for assigned and responsible
  it('uses correct icon for assigned and responsible reasons', () => {
    const { rerender } = render(<NotificationItem notification={mockNotification({ reason: 'assigned' })} />)
    expect(screen.getByText('📋')).toBeInTheDocument()

    rerender(<NotificationItem notification={mockNotification({ reason: 'responsible' })} />)
    expect(screen.getByText('📋')).toBeInTheDocument()
  })
})
