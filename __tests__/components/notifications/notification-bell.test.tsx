import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useNotifications', () => ({
  useUnreadCount: vi.fn(),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useUnreadCount } from '@/hooks/useNotifications'

// ─── NotificationBell ─────────────────────────────────────────────────────────

describe('NotificationBell', () => {
  // ✅ VALID: renders bell icon
  it('renders bell icon', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /notifications/i })
    expect(bellButton).toBeInTheDocument()
    // Bell SVG should be present
    const svg = bellButton.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // ✅ VALID: badge is hidden when count is 0
  it('hides badge when unread count is zero', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    // No red badge should be visible
    const badges = document.querySelectorAll('.bg-red-500')
    expect(badges.length).toBe(0)
  })

  // ✅ VALID: badge shows actual count when count <= 99
  it('shows badge with count when unread count is between 1 and 99', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 5,
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
    } as any)

    render(<NotificationBell />)

    // While loading, badge should not appear even though data exists
    const badgeInDocument = document.querySelector('.bg-red-500')
    expect(badgeInDocument).not.toBeInTheDocument()
  })

  // ✅ VALID: aria-label includes unread count
  it('has aria-label that includes unread count when present', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 7,
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
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: 'Notifications' })
    expect(bellButton).toBeInTheDocument()
  })

  // ✅ VALID: bell has correct hover styling classes
  it('bell button has hover background class', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 0,
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const bellButton = screen.getByRole('button')
    expect(bellButton.className).toContain('hover:bg-gray-100')
  })

  // ✅ VALID: badge is positioned absolutely relative to parent
  it('badge is absolutely positioned relative to button', () => {
    vi.mocked(useUnreadCount).mockReturnValue({
      data: 3,
      isLoading: false,
    } as any)

    render(<NotificationBell />)

    const badge = screen.getByText('3')
    // The badge span should have absolute positioning and be inside a relative parent
    expect(badge.parentElement).toBeInTheDocument()
    // The badge itself should have absolute class
    expect(badge.className).toContain('absolute')
  })
})
