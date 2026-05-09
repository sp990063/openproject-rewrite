import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock next/router ─────────────────────────────────────────────────────────
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { projectId: 'prj1' }, push: vi.fn() }),
}))

// ─── Imports of components under test ─────────────────────────────────────────
import { WikiPageView } from '@/components/wiki/WikiPageView'
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

// ─── WikiPageView ───────────────────────────────────────────────────────────────

describe('WikiPageView', () => {
  // ✅ VALID: renders page title
  it('renders page title', () => {
    render(<WikiPageView page={mockPage({ title: 'My Wiki Page' })} onEdit={vi.fn()} />)
    expect(screen.getByText('My Wiki Page')).toBeInTheDocument()
  })

  // ✅ VALID: renders author name in meta
  it('renders author name in meta', () => {
    render(<WikiPageView page={mockPage()} onEdit={vi.fn()} />)
    expect(screen.getByText('Wiki Author')).toBeInTheDocument()
  })

  // ✅ VALID: renders version number in meta
  it('renders version number in meta', () => {
    render(<WikiPageView page={mockPage({ version: 5 })} onEdit={vi.fn()} />)
    expect(screen.getByText('Version 5')).toBeInTheDocument()
  })

  // ✅ VALID: renders page content (inside prose > pre for markdown)
  it('renders page content', () => {
    render(<WikiPageView page={mockPage({ content: '# Hello\n\nWorld' })} onEdit={vi.fn()} />)
    const pre = document.querySelector('.prose pre')
    expect(pre).toBeInTheDocument()
    expect(pre?.textContent).toContain('Hello')
    expect(pre?.textContent).toContain('World')
  })

  // ✅ VALID: renders Edit button and calls onEdit
  it('renders Edit button and calls onEdit when clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<WikiPageView page={mockPage()} onEdit={onEdit} />)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  // ✅ VALID: renders History button when onShowHistory provided
  it('renders History button when onShowHistory is provided', () => {
    render(<WikiPageView page={mockPage()} onEdit={vi.fn()} onShowHistory={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
  })

  // ✅ VALID: History button NOT rendered when onShowHistory omitted
  it('does not render History button when onShowHistory is omitted', () => {
    render(<WikiPageView page={mockPage()} onEdit={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument()
  })

  // ✅ VALID: calls onShowHistory when History button clicked
  it('calls onShowHistory when History button is clicked', async () => {
    const user = userEvent.setup()
    const onShowHistory = vi.fn()
    render(<WikiPageView page={mockPage()} onEdit={vi.fn()} onShowHistory={onShowHistory} />)
    await user.click(screen.getByRole('button', { name: 'History' }))
    expect(onShowHistory).toHaveBeenCalledOnce()
  })

  // ✅ VALID: renders breadcrumb when parent exists
  it('renders breadcrumb when parent page exists', () => {
    const page = mockPage({
      parent: { id: 'parent1', title: 'Parent Page', slug: 'parent-page' },
    })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('Parent Page')).toBeInTheDocument()
  })

  // ✅ VALID: breadcrumb link has correct href
  it('breadcrumb link has correct href', () => {
    const page = mockPage({
      parent: { id: 'parent1', title: 'Parent Page', slug: 'parent-page' },
    })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    const breadcrumbLink = screen.getByText('Parent Page')
    expect(breadcrumbLink.closest('a')).toHaveAttribute('href', '/projects/prj1/wiki/parent-page')
  })

  // ✅ VALID: renders child pages section when children exist
  it('renders child pages section when children exist', () => {
    const page = mockPage({
      children: [
        { id: 'child1', title: 'Child Page 1', slug: 'child-1' },
        { id: 'child2', title: 'Child Page 2', slug: 'child-2' },
      ],
    })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('Child Pages')).toBeInTheDocument()
    expect(screen.getByText('Child Page 1')).toBeInTheDocument()
    expect(screen.getByText('Child Page 2')).toBeInTheDocument()
  })

  // ✅ VALID: child page links have correct hrefs
  it('child page links have correct hrefs', () => {
    const page = mockPage({
      children: [{ id: 'child1', title: 'Child Page', slug: 'child-page' }],
    })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    const childLink = screen.getByText('Child Page')
    expect(childLink.closest('a')).toHaveAttribute('href', '/projects/prj1/wiki/child-page')
  })

  // ✅ VALID: does not render child pages section when no children
  it('does not render child pages section when children array is empty', () => {
    render(<WikiPageView page={mockPage({ children: [] })} onEdit={vi.fn()} />)
    expect(screen.queryByText('Child Pages')).not.toBeInTheDocument()
  })

  // ✅ VALID: renders version count when versionCount > 0
  it('renders version count when versionCount > 0', () => {
    render(<WikiPageView page={mockPage({ versionCount: 5 })} onEdit={vi.fn()} />)
    expect(screen.getByText('5 revisions')).toBeInTheDocument()
  })

  // ✅ VALID: singular "revision" when versionCount is 1
  it('uses singular "revision" when versionCount is 1', () => {
    render(<WikiPageView page={mockPage({ versionCount: 1 })} onEdit={vi.fn()} />)
    expect(screen.getByText('1 revision')).toBeInTheDocument()
  })

  // ✅ VALID: does not render version count when versionCount is 0
  it('does not render version count text when versionCount is 0', () => {
    render(<WikiPageView page={mockPage({ versionCount: 0 })} onEdit={vi.fn()} />)
    expect(screen.queryByText(/revision/)).not.toBeInTheDocument()
  })

  // ✅ EDGE CASE: renders "Unknown" when author is null
  it('renders Unknown when author is missing', () => {
    const page = mockPage({ author: null })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  // ✅ VALID: shows raw markdown in prose wrapper
  it('renders content inside prose class', () => {
    render(<WikiPageView page={mockPage()} onEdit={vi.fn()} />)
    const prose = document.querySelector('.prose')
    expect(prose).toBeInTheDocument()
  })

  // ✅ VALID: extracts and displays TOC from headings
  it('displays table of contents when content has headings', () => {
    const page = mockPage({
      content: '# Heading 1\n\n## Heading 2\n\n### Heading 3',
    })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('On This Page')).toBeInTheDocument()
  })
})

// ─── extractTableOfContents (internal function) ─────────────────────────────────

describe('extractTableOfContents', () => {
  // These tests verify the internal TOC extraction logic

  it('extracts h1 headings', () => {
    const page = mockPage({ content: '# Title\n\nSome text' })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  it('extracts multiple heading levels', () => {
    const page = mockPage({ content: '# H1\n## H2\n### H3\n#### H4' })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    expect(screen.getByText('H1')).toBeInTheDocument()
    expect(screen.getByText('H2')).toBeInTheDocument()
    expect(screen.getByText('H3')).toBeInTheDocument()
    expect(screen.getByText('H4')).toBeInTheDocument()
  })

  it('generates id for each heading', () => {
    const page = mockPage({ content: '# Getting Started\n## Installation' })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    // The TOC should have links with #getting-started and #installation
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).toContain('#getting-started')
    expect(hrefs).toContain('#installation')
  })

  it('handles special characters in headings', () => {
    const page = mockPage({ content: '# Hello & World (Test)\n## Foo & Bar' })
    render(<WikiPageView page={page} onEdit={vi.fn()} />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs.some(h => h === '#hello-world-test')).toBe(true)
  })
})
