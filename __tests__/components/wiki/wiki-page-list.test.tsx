import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock next/router ─────────────────────────────────────────────────────────
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { projectId: 'prj1' }, push: vi.fn() }),
}))

// ─── Imports of components under test ─────────────────────────────────────────
import { WikiPageList } from '@/components/wiki/WikiPageList'
import type { WikiPageWithMeta } from '@/types/wiki'

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const mockAuthor = { id: 'author1', name: 'Wiki Author' }

const mockPage = (overrides: Partial<WikiPageWithMeta> = {}): WikiPageWithMeta => ({
  id: 'page1',
  projectId: 'prj1',
  title: 'Test Wiki Page',
  slug: 'test-wiki-page',
  content: '# Hello\n\nWorld',
  parentId: null,
  authorId: 'author1',
  version: 1,
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-15').toISOString(),
  author: mockAuthor,
  parent: null,
  children: [],
  versionCount: 0,
  ...overrides,
})

// ─── WikiPageList ──────────────────────────────────────────────────────────────

describe('WikiPageList', () => {
  // ✅ VALID: renders list of wiki pages
  it('renders list of wiki pages', () => {
    const pages = [
      mockPage({ id: 'page1', title: 'Page One', slug: 'page-one' }),
      mockPage({ id: 'page2', title: 'Page Two', slug: 'page-two' }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.getByText('Page One')).toBeInTheDocument()
    expect(screen.getByText('Page Two')).toBeInTheDocument()
  })

  // ✅ VALID: each page links to correct URL
  it('each page links to correct URL', () => {
    const pages = [
      mockPage({ id: 'page1', title: 'Page One', slug: 'page-one' }),
      mockPage({ id: 'page2', title: 'Page Two', slug: 'page-two' }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/projects/prj1/wiki/page-one')
    expect(links[1]).toHaveAttribute('href', '/projects/prj1/wiki/page-two')
  })

  // ✅ VALID: renders author and version in meta
  it('renders author name and version for each page', () => {
    const pages = [
      mockPage({ id: 'page1', title: 'Page One', version: 3 }),
      mockPage({ id: 'page2', title: 'Page Two', version: 7 }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.getByText('Wiki Author · v3')).toBeInTheDocument()
    expect(screen.getByText('Wiki Author · v7')).toBeInTheDocument()
  })

  // ✅ VALID: renders child count when page has children
  it('renders child count when page has children', () => {
    const pages = [
      mockPage({
        id: 'page1',
        title: 'Parent Page',
        children: [
          { id: 'child1', title: 'Child 1', slug: 'child-1' },
          { id: 'child2', title: 'Child 2', slug: 'child-2' },
        ],
      }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.getByText(/2 children/)).toBeInTheDocument()
  })

  // ✅ VALID: singular "child" when only one child
  it('uses singular "child" when only one child', () => {
    const pages = [
      mockPage({
        id: 'page1',
        title: 'Parent Page',
        children: [{ id: 'child1', title: 'Child 1', slug: 'child-1' }],
      }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.getByText('Wiki Author · v1 · 1 child')).toBeInTheDocument()
  })

  // ✅ VALID: no child count text when children array is empty
  it('does not show child count when children array is empty', () => {
    const pages = [mockPage({ id: 'page1', title: 'Page One', children: [] })]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.queryByText(/children/)).not.toBeInTheDocument()
  })

  // ✅ VALID: renders Unknown when author is missing
  it('renders Unknown when author is missing', () => {
    const pages = [mockPage({ id: 'page1', author: null })]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    expect(screen.getByText(/Unknown · v1/)).toBeInTheDocument()
  })

  // ✅ VALID: renders empty state when pages array is empty
  it('renders empty state when pages array is empty', () => {
    render(<WikiPageList pages={[]} projectId="prj1" />)
    expect(screen.getByText('No wiki pages yet')).toBeInTheDocument()
  })

  // ✅ VALID: renders SVG icon in empty state
  it('renders SVG icon in empty state', () => {
    render(<WikiPageList pages={[]} projectId="prj1" />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // ✅ VALID: renders loading skeletons when isLoading=true
  it('renders loading skeletons when isLoading is true', () => {
    render(<WikiPageList pages={[]} projectId="prj1" isLoading={true} />)
    // Should have 4 skeleton items (hardcoded in component)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })

  // ✅ VALID: does not show empty state when isLoading=true
  it('does not show empty state when isLoading is true', () => {
    render(<WikiPageList pages={[]} projectId="prj1" isLoading={true} />)
    expect(screen.queryByText('No wiki pages yet')).not.toBeInTheDocument()
  })

  // ✅ VALID: does not render any items when pages is null/undefined
  it('shows empty state when pages is null', () => {
    render(<WikiPageList pages={null as any} projectId="prj1" />)
    expect(screen.getByText('No wiki pages yet')).toBeInTheDocument()
  })

  // ✅ EDGE CASE: pages with very long titles truncate correctly
  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(100)
    const pages = [mockPage({ id: 'page1', title: longTitle })]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    // The title should be rendered and truncated via CSS
    expect(screen.getByText(longTitle)).toBeInTheDocument()
    const titleEl = document.querySelector('.truncate')
    expect(titleEl).toBeInTheDocument()
  })

  // ✅ VALID: renders chevron icon for each item
  it('renders chevron icon for each item', () => {
    const pages = [
      mockPage({ id: 'page1', title: 'Page One' }),
      mockPage({ id: 'page2', title: 'Page Two' }),
    ]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    const chevrons = document.querySelectorAll('svg')
    expect(chevrons.length).toBeGreaterThanOrEqual(2)
  })

  // ✅ VALID: hover effect class is applied (on inner div, not Link wrapper)
  it('item has hover background class', () => {
    const pages = [mockPage({ id: 'page1', title: 'Page One' })]
    render(<WikiPageList pages={pages} projectId="prj1" />)
    // hover:bg-gray-50 is on the inner div inside the Link
    const item = screen.getByText('Page One').closest('a').querySelector('div')
    expect(item?.className).toContain('hover:bg-gray-50')
  })
})

// ─── WikiPageSkeleton (internal) ────────────────────────────────────────────────

describe('WikiPageSkeleton', () => {
  // The skeleton is rendered internally when isLoading=true

  it('renders skeleton items when isLoading', () => {
    render(<WikiPageList pages={[]} projectId="prj1" isLoading={true} />)
    const skeletonDivs = document.querySelectorAll('.animate-pulse')
    expect(skeletonDivs.length).toBeGreaterThan(0)
  })

  it('renders correct number of skeleton items (4)', () => {
    render(<WikiPageList pages={[]} projectId="prj1" isLoading={true} />)
    // Component renders Array.from({ length: 4 }).map(...)
    // Each skeleton item: 1 pulse for icon + 2 pulses for text lines = 3 per item × 4 = 12
    const items = document.querySelectorAll('.animate-pulse')
    expect(items.length).toBe(12)
  })
})
