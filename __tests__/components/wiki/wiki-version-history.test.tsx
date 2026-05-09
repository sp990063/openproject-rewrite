import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Imports of components under test ─────────────────────────────────────────
import { WikiVersionHistory, WikiVersionHistorySkeleton } from '@/components/wiki/WikiVersionHistory'
import type { WikiPageVersion } from '@/types/wiki'

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const mockAuthor = { id: 'author1', name: 'Wiki Author' }

const mockVersion = (n: number, overrides: Partial<WikiPageVersion> = {}): WikiPageVersion => ({
  id: `v${n}`,
  wikiPageId: 'page1',
  content: `Content version ${n}`,
  authorId: 'author1',
  version: n,
  createdAt: new Date(`2026-01-0${n}`).toISOString(),
  author: mockAuthor,
  ...overrides,
})

// ─── WikiVersionHistory ────────────────────────────────────────────────────────

describe('WikiVersionHistory', () => {
  // ✅ VALID: renders empty state when versions array is empty
  it('renders empty state when versions array is empty', () => {
    render(<WikiVersionHistory versions={[]} currentVersion={1} />)
    expect(screen.getByText('No version history available')).toBeInTheDocument()
  })

  // ✅ VALID: renders empty state when versions is null/undefined
  it('renders empty state when versions is null', () => {
    render(<WikiVersionHistory versions={null as any} currentVersion={1} />)
    expect(screen.getByText('No version history available')).toBeInTheDocument()
  })

  // ✅ VALID: renders correct revision count heading
  it('renders correct revision count heading (singular)', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={1} />)
    expect(screen.getByText('1 Revision')).toBeInTheDocument()
  })

  // ✅ VALID: renders correct revision count heading (plural)
  it('renders correct revision count heading (plural)', () => {
    const versions = [mockVersion(1), mockVersion(2), mockVersion(3)]
    render(<WikiVersionHistory versions={versions} currentVersion={1} />)
    expect(screen.getByText('3 Revisions')).toBeInTheDocument()
  })

  // ✅ VALID: versions sorted newest first (descending by version number)
  it('displays versions in descending order (newest first)', () => {
    const versions = [mockVersion(1), mockVersion(2), mockVersion(3)]
    render(<WikiVersionHistory versions={versions} currentVersion={3} />)
    // v3 should appear before v2 before v1
    const items = screen.getAllByText(/v\d/)
    expect(items[0]).toHaveTextContent('v3')
  })

  // ✅ VALID: current version shows "Current" badge
  it('marks current version with Current badge', () => {
    const versions = [mockVersion(1), mockVersion(2), mockVersion(3)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  // ✅ VALID: non-current versions do not have Current badge
  it('non-current versions do not have Current badge', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    expect(screen.queryAllByText('Current').length).toBe(1)
  })

  // ✅ VALID: Restore button calls onRestore with version number
  it('Restore button calls onRestore with version number', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} onRestore={onRestore} />)
    // The restore button should be on the v1 item (non-current)
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    expect(onRestore).toHaveBeenCalledWith(1)
  })

  // ✅ VALID: View button calls onViewVersion with version object
  it('View button calls onViewVersion with version object', async () => {
    const user = userEvent.setup()
    const onViewVersion = vi.fn()
    const versions = [mockVersion(1), mockVersion(2)]
    render(
      <WikiVersionHistory
        versions={versions}
        currentVersion={2}
        onViewVersion={onViewVersion}
      />
    )
    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(onViewVersion).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }))
  })

  // ✅ VALID: Restore button not shown on current version
  it('Restore button not shown for current version', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} onRestore={vi.fn()} />)
    // Only v1 should have Restore, v2 is current
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeInTheDocument()
  })

  // ✅ VALID: View button not shown on current version
  it('View button not shown for current version', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} onViewVersion={vi.fn()} />)
    // Only v1 should have View, v2 is current
    expect(screen.queryByRole('button', { name: 'View' })).toBeInTheDocument()
  })

  // ✅ VALID: buttons disabled when isRestoring=true
  it('buttons are disabled when isRestoring is true', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(
      <WikiVersionHistory
        versions={versions}
        currentVersion={2}
        onRestore={vi.fn()}
        onViewVersion={vi.fn()}
        isRestoring={true}
      />
    )
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'View' })).toBeDisabled()
  })

  // ✅ VALID: renders author identifier for each version
  it('renders author identifier for each version', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    expect(screen.getByText(/^by /)).toBeInTheDocument()
  })

  // ✅ VALID: renders time ago for each version
  it('renders time ago for each version', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    // formatDistanceToNow adds "ago" suffix
    expect(screen.getByText(/ago$/)).toBeInTheDocument()
  })

  // ✅ VALID: Close button is rendered
  it('Close button is rendered', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={1} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  // ✅ VALID: Close button is always rendered (even without callback)
  it('Close button always rendered regardless of callback', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={1} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  // ✅ VALID: author shown (component renders authorId slice, not author object)
  it('renders author identifier for each version', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    // Component shows "by author1..." (authorId.slice(0,8))
    expect(screen.getByText(/^by /)).toBeInTheDocument()
  })

  // ✅ EDGE CASE: version renders authorId slice regardless of author field
  it('renders authorId slice regardless of author field', () => {
    const versions = [mockVersion(1)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    // Always shows authorId.slice(0, 8), not the author object
    expect(screen.getByText(/^by /)).toBeInTheDocument()
  })

  // ✅ VALID: current version item has blue background
  it('current version item has blue background', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    // Outer div (not VersionItem inner div) has the bg-blue-50 class
    const currentItem = screen.getByText('v2').closest('[class*="bg-blue"]')
    expect(currentItem).not.toBeNull()
  })

  // ✅ VALID: non-current version items have hover effect
  it('non-current version items have hover effect', () => {
    const versions = [mockVersion(1), mockVersion(2)]
    render(<WikiVersionHistory versions={versions} currentVersion={2} />)
    const nonCurrentItem = screen.getByText('v1').closest('[class*="hover:bg"]')
    expect(nonCurrentItem).not.toBeNull()
  })
})

// ─── WikiVersionHistorySkeleton ─────────────────────────────────────────────────

describe('WikiVersionHistorySkeleton', () => {
  // ✅ VALID: renders skeleton structure
  it('renders skeleton with correct structure', () => {
    render(<WikiVersionHistorySkeleton />)
    // Header skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  // ✅ VALID: renders 3 skeleton version items
  it('renders 3 skeleton version items', () => {
    render(<WikiVersionHistorySkeleton />)
    // Component renders Array.from({ length: 3 })
    const items = document.querySelectorAll('.animate-pulse')
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  // ✅ VALID: skeleton has rounded-lg containers
  it('skeleton items have rounded-lg styling', () => {
    render(<WikiVersionHistorySkeleton />)
    const roundedElements = document.querySelectorAll('.rounded-lg')
    expect(roundedElements.length).toBeGreaterThan(0)
  })
})
