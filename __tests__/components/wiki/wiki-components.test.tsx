import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Imports of components under test ─────────────────────────────────────────
import { WikiEmptyState, WikiEmptyStateCompact } from '@/components/wiki/WikiEmptyState'
import { WikiTableOfContents } from '@/components/wiki/WikiTableOfContents'
import type { WikiPageWithMeta, WikiPageVersion } from '@/types/wiki'

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

const mockVersion = (n: number, overrides: Partial<WikiPageVersion> = {}): WikiPageVersion => ({
  id: `v${n}`,
  wikiPageId: 'page1',
  content: `Content version ${n}`,
  authorId: 'author1',
  version: n,
  createdAt: new Date(`2026-01-0${n}`).toISOString(),
  ...overrides,
})

// ─── WikiEmptyState ─────────────────────────────────────────────────────────────

describe('WikiEmptyState', () => {
  // ✅ VALID: renders heading and description
  it('renders heading and description', () => {
    render(<WikiEmptyState projectId="prj1" />)
    expect(screen.getByText('No Wiki Pages Yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first wiki page/i)).toBeInTheDocument()
  })

  // ✅ VALID: renders SVG icon
  it('renders SVG icon', () => {
    render(<WikiEmptyState projectId="prj1" />)
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  // ✅ VALID: renders 3 tip cards
  it('renders three tip cards', () => {
    render(<WikiEmptyState projectId="prj1" />)
    expect(screen.getByText('Write in Markdown')).toBeInTheDocument()
    expect(screen.getByText('Organize with Hierarchy')).toBeInTheDocument()
    expect(screen.getByText('Track Changes')).toBeInTheDocument()
  })

  // ✅ VALID: button rendered when onCreatePage provided
  it('renders create button when onCreatePage is provided', () => {
    const onCreatePage = vi.fn()
    render(<WikiEmptyState projectId="prj1" onCreatePage={onCreatePage} />)
    expect(screen.getByRole('button', { name: /create first page/i })).toBeInTheDocument()
  })

  // ✅ VALID: button NOT rendered when onCreatePage omitted
  it('does not render button when onCreatePage is omitted', () => {
    render(<WikiEmptyState projectId="prj1" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // ✅ VALID: callback invoked when button is clicked
  it('calls onCreatePage when button is clicked', async () => {
    const user = userEvent.setup()
    const onCreatePage = vi.fn()
    render(<WikiEmptyState projectId="prj1" onCreatePage={onCreatePage} />)
    await user.click(screen.getByRole('button', { name: /create first page/i }))
    expect(onCreatePage).toHaveBeenCalledOnce()
  })
})

// ─── WikiEmptyStateCompact ─────────────────────────────────────────────────────

describe('WikiEmptyStateCompact', () => {
  it('renders no wiki pages message', () => {
    render(<WikiEmptyStateCompact />)
    expect(screen.getByText('No wiki pages')).toBeInTheDocument()
  })

  it('renders create link when onCreatePage provided', () => {
    const onCreatePage = vi.fn()
    render(<WikiEmptyStateCompact onCreatePage={onCreatePage} />)
    expect(screen.getByText('Create the first one')).toBeInTheDocument()
  })

  it('does not render create link when onCreatePage omitted', () => {
    render(<WikiEmptyStateCompact />)
    expect(screen.queryByText('Create the first one')).not.toBeInTheDocument()
  })

  it('calls onCreatePage when link is clicked', async () => {
    const user = userEvent.setup()
    const onCreatePage = vi.fn()
    render(<WikiEmptyStateCompact onCreatePage={onCreatePage} />)
    await user.click(screen.getByText('Create the first one'))
    expect(onCreatePage).toHaveBeenCalledOnce()
  })
})

// ─── WikiTableOfContents ───────────────────────────────────────────────────────

describe('WikiTableOfContents', () => {
  const headings = [
    { level: 1, text: 'Introduction', id: 'introduction' },
    { level: 2, text: 'Getting Started', id: 'getting-started' },
    { level: 2, text: 'Installation', id: 'installation' },
    { level: 3, text: 'Requirements', id: 'requirements' },
  ]

  // ✅ VALID: returns null when headings is empty
  it('returns null when headings array is empty', () => {
    const { container } = render(<WikiTableOfContents headings={[]} />)
    expect(container.firstChild).toBeNull()
  })

  // ✅ VALID: returns null when headings is null/undefined
  it('returns null when headings is null', () => {
    const { container } = render(<WikiTableOfContents headings={null as any} />)
    expect(container.firstChild).toBeNull()
  })

  // ✅ VALID: renders all headings with correct text
  it('renders all heading texts', () => {
    render(<WikiTableOfContents headings={headings} />)
    expect(screen.getByText('Introduction')).toBeInTheDocument()
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('Installation')).toBeInTheDocument()
    expect(screen.getByText('Requirements')).toBeInTheDocument()
  })

  // ✅ VALID: renders correct number of items
  it('renders correct number of TOC items', () => {
    render(<WikiTableOfContents headings={headings} />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(4)
  })

  // ✅ VALID: active heading gets blue styling
  it('applies blue styling to active heading', () => {
    render(<WikiTableOfContents headings={headings} activeId="getting-started" />)
    const activeLink = screen.getByText('Getting Started')
    expect(activeLink.className).toContain('text-blue-600')
  })

  // ✅ VALID: inactive headings get gray styling
  it('applies gray styling to inactive headings', () => {
    render(<WikiTableOfContents headings={headings} activeId="introduction" />)
    const inactiveLink = screen.getByText('Getting Started')
    expect(inactiveLink.className).toContain('text-gray-600')
  })

  // ✅ VALID: h1 headings have no indent (level 1)
  it('h1 heading has no extra indent', () => {
    render(<WikiTableOfContents headings={headings} />)
    const items = screen.getAllByRole('listitem')
    // First item (h1) should have paddingLeft: 0
    expect(items[0]).toHaveStyle({ paddingLeft: '0px' })
  })

  // ✅ VALID: h2 headings are indented 12px
  it('h2 heading is indented 12px', () => {
    render(<WikiTableOfContents headings={headings} />)
    const items = screen.getAllByRole('listitem')
    // Second item (h2) should have paddingLeft: 12px
    expect(items[1]).toHaveStyle({ paddingLeft: '12px' })
  })

  // ✅ VALID: h3 headings are indented 24px
  it('h3 heading is indented 24px', () => {
    render(<WikiTableOfContents headings={headings} />)
    const items = screen.getAllByRole('listitem')
    // Fourth item (h3) should have paddingLeft: 24px
    expect(items[3]).toHaveStyle({ paddingLeft: '24px' })
  })

  // ✅ VALID: links have correct href
  it('heading links have correct href', () => {
    render(<WikiTableOfContents headings={headings} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '#introduction')
    expect(links[1]).toHaveAttribute('href', '#getting-started')
  })

  // ✅ VALID: aria-label is set
  it('has aria-label for accessibility', () => {
    render(<WikiTableOfContents headings={headings} />)
    expect(screen.getByRole('navigation', { name: /table of contents/i })).toBeInTheDocument()
  })
})
