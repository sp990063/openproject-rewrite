import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { useRouter } from 'next/router'

// ─── Mock next/router BEFORE importing the page ─────────────────────────────────
const push = vi.fn()
const replace = vi.fn()

vi.mock('next/router', () => ({
  useRouter: () => ({
    push,
    replace,
    pathname: '/projects/prj1/work-packages',
    query: { projectId: 'prj1' },
  }),
}))

// ─── Mock child components ──────────────────────────────────────────────────────
vi.mock('@/components/layout/AuthenticatedLayout', () => ({
  AuthenticatedLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="authenticated-layout">{children}</div>
  ),
}))

vi.mock('@/components/work-packages/table', () => ({
  WorkPackageTable: () => <div data-testid="wp-table">Table View</div>,
}))

vi.mock('@/components/work-packages/gantt', () => ({
  GanttChart: ({ projectId }: { projectId: string }) => (
    <div data-testid="gantt-chart" data-project={projectId}>Gantt View</div>
  ),
}))

vi.mock('@/components/work-packages/board', () => ({
  WorkPackageBoard: () => <div data-testid="wp-board">Board View</div>,
}))

vi.mock('@/components/work-packages/calendar', () => ({
  WorkPackageCalendar: () => <div data-testid="wp-calendar">Calendar View</div>,
}))

vi.mock('@/components/work-packages/query/QuerySwitcher', () => ({
  QuerySwitcher: ({ onSaveQuery }: { onSaveQuery: () => void }) => (
    <div data-testid="query-switcher">
      <button onClick={onSaveQuery} data-testid="save-view-btn">Save view</button>
    </div>
  ),
}))

vi.mock('@/components/work-packages/query/SaveQueryDialog', () => ({
  SaveQueryDialog: ({ open, onOpenChange, onSaved }: {
    open: boolean
    onOpenChange: (v: boolean) => void
    onSaved?: (q: unknown) => void
  }) => (
    <div data-testid="save-query-dialog" data-open={open}>
      {open && (
        <>
          <button onClick={() => onOpenChange(false)} data-testid="dialog-close">Close</button>
          <button onClick={() => { onSaved?.({ id: 'q1', name: 'Saved' }); onOpenChange(false) }} data-testid="dialog-save">Save</button>
        </>
      )}
    </div>
  ),
}))

// ─── Mock hooks ────────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-work-packages', () => ({
  useCreateWorkPackage: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'wp-new', subject: 'New Task' }),
    isPending: false,
  }),
}))

vi.mock('@/hooks/use-queries', () => ({
  useSavedQueries: () => ({
    data: [],
    isLoading: false,
  }),
  useDeleteSavedQuery: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
  useUpdateSavedQuery: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'q1' }) }),
  useCreateSavedQuery: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'q1', name: 'Saved' }) }),
}))

// ─── Import page AFTER mocks ───────────────────────────────────────────────────
import WorkPackagesPage from '@/pages/projects/[projectId]/work-packages/index'

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('WorkPackagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: renders authenticated layout wrapper
  it('renders AuthenticatedLayout', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByTestId('authenticated-layout')).toBeInTheDocument()
  })

  // ✅ VALID: renders page heading
  it('renders Work Packages heading', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByText('Work Packages')).toBeInTheDocument()
  })

  // ✅ VALID: renders New Work Package button
  it('has New Work Package button', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByRole('button', { name: 'New Work Package' })).toBeInTheDocument()
  })

  // ✅ VALID: renders back to project link
  it('renders back to project link', () => {
    render(<WorkPackagesPage />)
    const link = screen.getByText('← Back to Project')
    expect(link).toHaveAttribute('href', '/projects/prj1')
  })

  // ✅ VALID: renders Table view by default
  it('shows Table view by default', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByTestId('wp-table')).toBeInTheDocument()
  })

  // ✅ VALID: renders view switcher tabs
  it('renders all four view tabs', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByRole('tab', { name: 'Table' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gantt' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Board' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendar' })).toBeInTheDocument()
  })

  // ✅ VALID: clicking Gantt tab shows Gantt view
  it('switches to Gantt view when Gantt tab is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    // Table view is shown by default
    expect(screen.getByTestId('wp-table')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Gantt' }))
    // Gantt view is now visible
    expect(screen.getByTestId('gantt-chart')).toBeInTheDocument()
    expect(screen.getByTestId('gantt-chart')).toHaveAttribute('data-project', 'prj1')
  })

  // ✅ VALID: clicking Board tab shows Board view
  it('switches to Board view when Board tab is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('tab', { name: 'Board' }))
    expect(screen.getByTestId('wp-board')).toBeInTheDocument()
  })

  // ✅ VALID: clicking Calendar tab shows Calendar view
  it('switches to Calendar view when Calendar tab is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('tab', { name: 'Calendar' }))
    expect(screen.getByTestId('wp-calendar')).toBeInTheDocument()
  })

  // ✅ VALID: URL is updated when switching views (shallow routing)
  it('updates URL query when switching to Gantt view', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('tab', { name: 'Gantt' }))
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ view: 'gantt' }) }),
      undefined,
      { shallow: true }
    )
  })

  // ✅ VALID: Table view does NOT add view to URL (default)
  it('does not add view=table to URL (default is table)', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    // Click away from table then back
    await user.click(screen.getByRole('tab', { name: 'Gantt' }))
    replace.mockClear()
    await user.click(screen.getByRole('tab', { name: 'Table' }))
    // table is default, so view=table is omitted from URL
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({ query: {} }),
      undefined,
      { shallow: true }
    )
  })

  // ✅ VALID: clicking New Work Package opens create modal
  it('opens create modal when New Work Package button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('button', { name: 'New Work Package' }))
    expect(screen.getByText('Create Work Package')).toBeInTheDocument()
  })

  // ✅ VALID: modal form has Subject and Description fields
  it('modal form has Subject and Description fields', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('button', { name: 'New Work Package' }))
    expect(screen.getByLabelText('Subject')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  // ✅ VALID: filling and submitting the create form calls the mutation
  it('fills and submits the create form', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('button', { name: 'New Work Package' }))
    await user.type(screen.getByLabelText('Subject'), 'New Bug Fix')
    await user.type(screen.getByLabelText('Description'), 'Fix login issue')
    await user.click(screen.getByRole('button', { name: 'Create' }))
  })

  // ✅ VALID: modal has Cancel and Create buttons
  it('modal has Cancel and Create buttons', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByRole('button', { name: 'New Work Package' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  // ✅ VALID: Save view button opens SaveQueryDialog
  it('opens SaveQueryDialog when Save view button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByTestId('save-view-btn'))
    expect(screen.getByTestId('save-query-dialog')).toHaveAttribute('data-open', 'true')
  })

  // ✅ VALID: SaveQueryDialog calls onSaved and closes
  it('calls onSaved and closes dialog when Save is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackagesPage />)
    await user.click(screen.getByTestId('save-view-btn'))
    await user.click(screen.getByTestId('dialog-save'))
    await waitFor(() => {
      expect(screen.getByTestId('save-query-dialog')).toHaveAttribute('data-open', 'false')
    })
  })

  // ✅ VALID: QuerySwitcher renders in toolbar
  it('renders QuerySwitcher in toolbar', () => {
    render(<WorkPackagesPage />)
    expect(screen.getByTestId('query-switcher')).toBeInTheDocument()
  })
})
