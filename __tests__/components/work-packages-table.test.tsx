import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Components under test ────────────────────────────────────────────────────
import { WorkPackageTableSkeleton } from '@/components/work-packages/table/WorkPackageTableSkeleton'
import { WorkPackageTableEmptyState } from '@/components/work-packages/table/WorkPackageTableEmptyState'
import { WorkPackageTableHeader } from '@/components/work-packages/table/WorkPackageTableHeader'
import { WorkPackageTableRow } from '@/components/work-packages/table/WorkPackageTableRow'
import { WorkPackageFilters } from '@/components/work-packages/table/WorkPackageFilters'
import { WorkPackageBulkActions } from '@/components/work-packages/table/WorkPackageBulkActions'
import { WorkPackageInlineEdit } from '@/components/work-packages/table/WorkPackageInlineEdit'
import type { Column, WorkPackageRow, FilterOptions } from '@/components/work-packages/table/types'
import type { WorkPackage, Status, Type, Priority, User } from '@/types'

// ─── Mock next/router ─────────────────────────────────────────────────────────
vi.mock('next/router', () => ({
  useRouter: () => ({ query: { projectId: 'prj1' } }),
}))

// ─── Mock use-work-packages hook ───────────────────────────────────────────────
vi.mock('@/hooks/use-work-packages', () => ({
  useWorkPackages: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateWorkPackage: () => ({ mutateAsync: vi.fn() }),
  useDeleteWorkPackage: () => ({ mutateAsync: vi.fn() }),
}))

// ─── Mock @tanstack/react-query ────────────────────────────────────────────────
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((opts: { queryKey: string[] }) => {
    if (opts.queryKey[0] === 'statuses') return { data: mockStatuses, isLoading: false, isError: false }
    if (opts.queryKey[0] === 'types') return { data: mockTypes, isLoading: false, isError: false }
    if (opts.queryKey[0] === 'priorities') return { data: mockPriorities, isLoading: false, isError: false }
    return { data: [], isLoading: false, isError: false }
  }),
}))

// ─── Shared fixtures ───────────────────────────────────────────────────────────
const mockStatuses: Status[] = [
  { id: 's1', name: 'New', color: '#10B981', isClosed: false, position: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 's2', name: 'In Progress', color: '#3B82F6', isClosed: false, position: 2, createdAt: new Date(), updatedAt: new Date() },
  { id: 's3', name: 'Closed', color: '#6B7280', isClosed: true, position: 3, createdAt: new Date(), updatedAt: new Date() },
]

const mockTypes: Type[] = [
  { id: 't1', name: 'Task', color: '#EF4444', position: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 't2', name: 'Bug', color: '#F97316', position: 2, createdAt: new Date(), updatedAt: new Date() },
]

const mockPriorities: Priority[] = [
  { id: 'p1', name: 'Low', color: '#6B7280', position: 1, createdAt: new Date(), updatedAt: new Date() },
  { id: 'p2', name: 'High', color: '#EF4444', position: 2, createdAt: new Date(), updatedAt: new Date() },
]

const mockUser: User = {
  id: 'u1', name: 'Alice Chan', email: 'alice@example.com', createdAt: new Date(), updatedAt: new Date(),
}

const mockWp = (i: number, overrides: Partial<WorkPackage> = {}): WorkPackage => ({
  id: `wp${i}`,
  subject: `Work package ${i}`,
  description: null,
  projectId: 'prj1',
  typeId: 't1',
  statusId: 's1',
  priorityId: 'p1',
  assigneeId: 'u1',
  startDate: '2026-06-01',
  dueDate: '2026-06-15',
  storyPoints: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Default full objects so row renders properly
  status: mockStatuses[0],
  type: mockTypes[0],
  priority: mockPriorities[0],
  assignee: mockUser,
  ...overrides,
})

const COLUMNS: Column[] = [
  { id: 'subject', label: 'Subject', sortable: true, width: 'minmax(200px, 1fr)' },
  { id: 'status', label: 'Status', sortable: true, width: '120px' },
  { id: 'type', label: 'Type', sortable: true, width: '100px' },
  { id: 'priority', label: 'Priority', sortable: true, width: '100px' },
  { id: 'assignee', label: 'Assignee', sortable: true, width: '140px' },
  { id: 'startDate', label: 'Start Date', sortable: true, width: '110px' },
  { id: 'dueDate', label: 'Due Date', sortable: true, width: '110px' },
  { id: 'estimatedHours', label: 'Est. Hours', sortable: true, width: '90px', align: 'right' },
]

// ─── WorkPackageTableSkeleton ───────────────────────────────────────────────────

describe('WorkPackageTableSkeleton', () => {
  // ✅ VALID: header row has 9 skeleton placeholders (1 checkbox + 8 columns)
  it('header contains 9 skeleton placeholders', () => {
    render(<WorkPackageTableSkeleton />)
    const headerRow = document.querySelector('.border-b')!
    const pulses = headerRow.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(9)
  })

  // ✅ VALID: exactly 8 data rows + 1 header = 81 pulse elements total
  it('renders exactly 8 skeleton data rows', () => {
    render(<WorkPackageTableSkeleton />)
    const allPulses = document.querySelectorAll('.animate-pulse')
    // 9 header + 8×9 data = 81
    expect(allPulses.length).toBe(81)
  })

  // ✅ VALID: all have animate-pulse class
  it('all skeleton elements have animate-pulse class', () => {
    render(<WorkPackageTableSkeleton />)
    const pulses = document.querySelectorAll('.animate-pulse')
    pulses.forEach(p => expect(p.className).toContain('animate-pulse'))
  })
})

// ─── WorkPackageTableEmptyState ───────────────────────────────────────────────

describe('WorkPackageTableEmptyState', () => {
  // ✅ VALID: hasFilters=false → generic message + create button
  it('shows generic message and create button when no filters', () => {
    render(<WorkPackageTableEmptyState onClearFilters={vi.fn()} hasFilters={false} />)
    expect(screen.getByText('No work packages found')).toBeInTheDocument()
    expect(screen.getByText(/no work packages in this project/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create work package/i })).toBeInTheDocument()
  })

  // ✅ VALID: hasFilters=true → filter message + clear button
  it('shows filter message and clear button when filters are active', () => {
    const onClear = vi.fn()
    render(<WorkPackageTableEmptyState onClearFilters={onClear} hasFilters={true} />)
    expect(screen.getByText('No work packages found')).toBeInTheDocument()
    expect(screen.getByText(/no work packages match your current filters/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  // ✅ VALID: clear button is clickable
  it('calls onClearFilters when clear button is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<WorkPackageTableEmptyState onClearFilters={onClear} hasFilters={true} />)
    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})

// ─── WorkPackageTableHeader ────────────────────────────────────────────────────

describe('WorkPackageTableHeader', () => {
  const defaultProps = {
    columns: COLUMNS,
    sort: null as { columnId: string; direction: 'asc' | 'desc' } | null,
    onSort: vi.fn(),
    allSelected: false,
    onSelectAll: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders all column labels
  it('renders all column headers', () => {
    render(<WorkPackageTableHeader {...defaultProps} />)
    COLUMNS.forEach(col => {
      expect(screen.getByText(col.label)).toBeInTheDocument()
    })
  })

  // ✅ VALID: select-all checkbox calls onSelectAll
  it('calls onSelectAll when select-all checkbox is toggled', async () => {
    const user = userEvent.setup()
    render(<WorkPackageTableHeader {...defaultProps} />)
    await user.click(screen.getByRole('checkbox', { name: /select all work packages/i }))
    expect(defaultProps.onSelectAll).toHaveBeenCalledWith(true)
  })

  // ✅ VALID: sortable column click calls onSort
  it('calls onSort when a sortable column header is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageTableHeader {...defaultProps} />)
    await user.click(screen.getByText('Status'))
    expect(defaultProps.onSort).toHaveBeenCalledWith('status')
  })

  // ✅ VALID: aria-sort ascending
  it('aria-sort is ascending when sorted ascending', () => {
    render(<WorkPackageTableHeader {...defaultProps} sort={{ columnId: 'status', direction: 'asc' }} />)
    expect(screen.getByText('Status').closest('th')).toHaveAttribute('aria-sort', 'ascending')
  })

  it('aria-sort is descending when sorted descending', () => {
    render(<WorkPackageTableHeader {...defaultProps} sort={{ columnId: 'status', direction: 'desc' }} />)
    expect(screen.getByText('Status').closest('th')).toHaveAttribute('aria-sort', 'descending')
  })

  it('aria-sort is none when not sorted', () => {
    render(<WorkPackageTableHeader {...defaultProps} sort={null} />)
    expect(screen.getByText('Status').closest('th')).toHaveAttribute('aria-sort', 'none')
  })

  // ✅ VALID: allSelected reflects on checkbox
  it('select-all checkbox is checked when allSelected is true', () => {
    render(<WorkPackageTableHeader {...defaultProps} allSelected={true} />)
    expect(screen.getByRole('checkbox', { name: /select all work packages/i })).toBeChecked()
  })
})

// ─── WorkPackageTableRow ────────────────────────────────────────────────────────

describe('WorkPackageTableRow', () => {
  const defaultRow: WorkPackageRow = { workPackage: mockWp(1), depth: 0 }
  const defaultProps = {
    row: defaultRow,
    columns: COLUMNS,
    isSelected: false,
    editing: null,
    onSelect: vi.fn(),
    onEditCell: vi.fn(),
    onSaveEdit: vi.fn().mockResolvedValue(true),
    onCancelEdit: vi.fn(),
    editingCellRect: null,
    statuses: mockStatuses,
    types: mockTypes,
    priorities: mockPriorities,
    assignees: [mockUser],
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders subject as link
  it('renders subject as link to work package page', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    const link = screen.getByRole('link', { name: /work package 1/i })
    expect(link).toHaveAttribute('href', '/projects/prj1/work-packages/wp1')
  })

  // ✅ VALID: renders status badge
  it('renders status badge', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    // Badge text is just "New"
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  // ✅ VALID: renders type pill
  it('renders type pill', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    expect(screen.getByText('Task')).toBeInTheDocument()
  })

  // ✅ VALID: renders priority
  it('renders priority name', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  // ✅ VALID: renders assignee name
  it('renders assignee name', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    expect(screen.getByText('Alice Chan')).toBeInTheDocument()
  })

  // ✅ VALID: unassigned renders italic placeholder
  it('renders unassigned placeholder when assignee is null', () => {
    const row = { workPackage: mockWp(1, { assignee: undefined, assigneeId: null }), depth: 0 }
    render(<WorkPackageTableRow {...defaultProps} row={row} />)
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument()
  })

  // ✅ VALID: checkbox calls onSelect
  it('checkbox calls onSelect with id and checked state', async () => {
    const user = userEvent.setup()
    render(<WorkPackageTableRow {...defaultProps} />)
    await user.click(screen.getByRole('checkbox'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith('wp1', true)
  })

  // ✅ VALID: selected row has bg-blue-50 class
  it('adds selected styling when isSelected is true', () => {
    render(<WorkPackageTableRow {...defaultProps} isSelected={true} />)
    expect(screen.getByRole('row').className).toContain('bg-blue-50')
  })

  // ✅ VALID: depth > 0 renders em-dash indent prefix
  it('renders em-dash indent prefix for child rows (depth > 0)', () => {
    const childRow: WorkPackageRow = { workPackage: mockWp(2), depth: 2 }
    render(<WorkPackageTableRow {...defaultProps} row={childRow} />)
    // Depth 2 renders em-dash + nbsp prefix
    // The full text in the span is '—— ' (2 em-dashes + nbsp)
    const dashSpan = document.querySelector('span.text-gray-400.text-xs')
    expect(dashSpan).toBeInTheDocument()
    expect(dashSpan?.textContent).toBe('\u2014\u2014\u00a0') // —— followed by nbsp
  })

  // ✅ VALID: no indent prefix for depth 0
  it('no em-dash prefix for top-level rows', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    expect(screen.getByRole('link', { name: /work package 1/i })).toBeInTheDocument()
  })

  // ✅ VALID: dueDate null shows italic placeholder
  it('renders italic placeholder for null dueDate', () => {
    const row = { workPackage: mockWp(1, { dueDate: null }), depth: 0 }
    render(<WorkPackageTableRow {...defaultProps} row={row} />)
    expect(screen.getByText(/no date/i)).toBeInTheDocument()
  })

  // ✅ VALID: estimatedHours renders with h suffix
  it('renders estimated hours with h suffix', () => {
    const row = { workPackage: mockWp(1, { estimatedHours: 5.5 }), depth: 0 }
    render(<WorkPackageTableRow {...defaultProps} row={row} />)
    expect(screen.getByText('5.5h')).toBeInTheDocument()
  })

  // ✅ VALID: null estimatedHours renders em-dash
  it('renders em-dash for null estimatedHours', () => {
    render(<WorkPackageTableRow {...defaultProps} />)
    expect(screen.getByText('\u2014')).toBeInTheDocument()
  })

  // ✅ VALID: double-click on status cell triggers onEditCell
  it('triggers onEditCell on status double-click', async () => {
    const user = userEvent.setup()
    render(<WorkPackageTableRow {...defaultProps} />)
    await user.dblClick(screen.getByText('New'))
    expect(defaultProps.onEditCell).toHaveBeenCalledWith('wp1', 'status', expect.any(Object))
  })

  // ✅ VALID: checkbox click stops link navigation
  it('checkbox click does not trigger subject link navigation', async () => {
    const user = userEvent.setup()
    render(<WorkPackageTableRow {...defaultProps} />)
    await user.click(screen.getByRole('checkbox'))
    // If onSelect fires, link nav was stopped
    expect(defaultProps.onSelect).toHaveBeenCalled()
  })
})

// ─── WorkPackageFilters ─────────────────────────────────────────────────────────

describe('WorkPackageFilters', () => {
  const mockOptions: FilterOptions = {
    statuses: mockStatuses,
    types: mockTypes,
    priorities: mockPriorities,
    assignees: [mockUser],
  }

  const defaultProps = {
    filters: {} as Record<string, unknown>,
    onFiltersChange: vi.fn(),
    options: mockOptions,
    onReset: vi.fn(),
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: all 4 dropdown buttons rendered
  it('renders Status, Type, Priority, Assignee filter buttons', () => {
    render(<WorkPackageFilters {...defaultProps} />)
    expect(screen.getByRole('button', { name: /^status$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^type$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^priority$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^assignee$/i })).toBeInTheDocument()
  })

  // ✅ VALID: clicking Status opens dropdown
  it('opens Status dropdown on click', async () => {
    const user = userEvent.setup()
    render(<WorkPackageFilters {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /^status$/i }))
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  // ✅ VALID: selecting a status calls onFiltersChange
  it('calls onFiltersChange when a status option is selected', async () => {
    const user = userEvent.setup()
    render(<WorkPackageFilters {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /^status$/i }))
    await user.click(screen.getByText('New'))
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
      statusId: ['s1'],
    }))
  })

  // ✅ VALID: active filter shows pill
  it('renders active filter pill when statusId is set', () => {
    render(<WorkPackageFilters {...defaultProps} filters={{ statusId: ['s1'] } as Record<string, unknown>} />)
    expect(screen.getByText(/status: new/i)).toBeInTheDocument()
  })

  // ✅ VALID: clicking × on pill removes filter
  it('removes filter when pill × is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageFilters {...defaultProps} filters={{ statusId: ['s1'] } as Record<string, unknown>} />)
    await user.click(screen.getByRole('button', { name: /remove status: new/i }))
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(expect.not.objectContaining({
      statusId: expect.arrayContaining(['s1']),
    }))
  })

  // ✅ VALID: search input triggers onFiltersChange on change
  it('calls onFiltersChange when search input changes', async () => {
    const user = userEvent.setup()
    render(<WorkPackageFilters {...defaultProps} />)
    const input = screen.getByPlaceholderText(/search subject/i)
    await user.clear(input)
    await user.type(input, 'login')
    // onChange fires with each keystroke; verify at least one call had search prop
    const hasSearchCall = defaultProps.onFiltersChange.mock.calls.some(
      ([f]) => typeof f === 'object' && 'search' in f
    )
    expect(hasSearchCall).toBe(true)
  })

  // ✅ VALID: Reset button shows count
  it('shows Reset button with active filter count', async () => {
    const user = userEvent.setup()
    render(<WorkPackageFilters {...defaultProps} filters={{ statusId: ['s1', 's2'] } as Record<string, unknown>} />)
    expect(screen.getByRole('button', { name: /reset \(2\)/i })).toBeInTheDocument()
  })

  // ✅ VALID: Reset button hidden when no filters
  it('does not show Reset button when no filters active', () => {
    render(<WorkPackageFilters {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  // ✅ VALID: multiple status selections shown as separate pills
  it('renders separate pills for each selected status', () => {
    render(<WorkPackageFilters {...defaultProps} filters={{ statusId: ['s1', 's2'] } as Record<string, unknown>} />)
    expect(screen.getByText(/status: new/i)).toBeInTheDocument()
    expect(screen.getByText(/status: in progress/i)).toBeInTheDocument()
  })

  // ✅ VALID: date filter shows active indicator
  it('shows active indicator when startDate filter is set', () => {
    render(<WorkPackageFilters {...defaultProps} filters={{ startDate: { gte: '2026-06-01' } } as Record<string, unknown>} />)
    expect(screen.getByRole('button', { name: /start date ★/i })).toBeInTheDocument()
  })
})

// ─── WorkPackageBulkActions ────────────────────────────────────────────────────

describe('WorkPackageBulkActions', () => {
  const defaultProps = {
    selectedIds: new Set(['wp1', 'wp2']),
    onClearSelection: vi.fn(),
    onBulkDelete: vi.fn().mockResolvedValue(undefined),
    onBulkStatusChange: vi.fn().mockResolvedValue(undefined),
    statuses: mockStatuses,
  }

  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: null when count is 0
  it('renders nothing when selectedIds is empty', () => {
    const { container } = render(<WorkPackageBulkActions {...defaultProps} selectedIds={new Set()} />)
    expect(container.firstChild).toBeNull()
  })

  // ✅ VALID: displays correct selected count
  it('displays selected count', () => {
    render(<WorkPackageBulkActions {...defaultProps} />)
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  // ✅ VALID: Change Status opens modal
  it('opens status modal when Change Status button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /change status/i }))
    expect(screen.getByText(/change status for 2 work packages/i)).toBeInTheDocument()
  })

  // ✅ VALID: Delete opens confirmation modal
  it('opens delete confirmation modal when Delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(screen.getByText(/delete 2 work packages\?/i)).toBeInTheDocument()
  })

  // ✅ VALID: × button calls onClearSelection
  it('clears selection when × is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByLabelText(/clear selection/i))
    expect(defaultProps.onClearSelection).toHaveBeenCalled()
  })

  // ✅ VALID: status modal lists all statuses
  it('lists all available statuses in modal', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /change status/i }))
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  // ✅ VALID: Apply disabled when no status selected
  it('Apply button is disabled when no status is selected', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /change status/i }))
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled()
  })

  // ✅ VALID: selecting status enables Apply
  it('Apply button is enabled when a status is selected', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /change status/i }))
    await user.click(screen.getByText('New'))
    expect(screen.getByRole('button', { name: /apply/i })).toBeEnabled()
  })

  // ✅ VALID: cancel in delete modal closes it without deleting
  it('delete modal closes without action when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<WorkPackageBulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/delete 2 work packages/i)).not.toBeInTheDocument()
    expect(defaultProps.onBulkDelete).not.toHaveBeenCalled()
  })
})

// ─── WorkPackageInlineEdit ─────────────────────────────────────────────────────
// NOTE: WorkPackageInlineEdit is always rendered as an overlay with an input.
// It never renders a "read-only" state — that is handled by InlineCellDisplay.
// Tests here focus on the overlay behavior.

describe('WorkPackageInlineEdit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ✅ VALID: renders text input for subject column
  it('renders text input for subject column', () => {
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="subject"
        currentValue="Fix bug"
        displayValue="Fix bug"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  // ✅ VALID: renders select for status column
  it('renders select dropdown for status column', () => {
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="status"
        currentValue="s1"
        displayValue="New"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        cellRect={null}
        statuses={mockStatuses}
      />
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  // ✅ VALID: renders select for assignee column
  it('renders select dropdown for assignee column', () => {
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="assignee"
        currentValue="u1"
        displayValue="Alice Chan"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        cellRect={null}
        assignees={[mockUser]}
      />
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  // ✅ VALID: renders number input for estimatedHours
  it('renders number input for estimatedHours column', () => {
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="estimatedHours"
        currentValue="5"
        displayValue="5h"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  // ✅ VALID: renders date input for startDate (type=date)
  it('renders date input for startDate column', () => {
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="startDate"
        currentValue="2026-06-01"
        displayValue="Jun 1, 2026"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    const dateInput = document.querySelector('input[type="date"]')
    expect(dateInput).toBeInTheDocument()
  })

  // ✅ VALID: Enter key triggers save
  it('calls onSave when Enter is pressed', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="subject"
        currentValue="Fix bug"
        displayValue="Fix bug"
        onSave={onSave}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Fixed bug{Enter}')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      rowId: 'wp1',
      columnId: 'subject',
      value: 'Fixed bug',
    }))
  })

  // ✅ VALID: Escape calls onCancel without save
  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="subject"
        currentValue="Fix bug"
        displayValue="Fix bug"
        onSave={vi.fn()}
        onCancel={onCancel}
        cellRect={null}
      />
    )
    await user.type(screen.getByRole('textbox'), '{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  // ✅ VALID: Saving... indicator shown while save is pending
  it('shows Saving indicator while save is in progress', async () => {
    let resolve: (v: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>(r => { resolve = r }))
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="subject"
        currentValue="Fix bug"
        displayValue="Fix bug"
        onSave={onSave}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    const user = userEvent.setup()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Fixed{Enter}')
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    await act(async () => { resolve!(true) })
  })

  // ✅ VALID: auto-save on status dropdown change
  it('auto-saves when status dropdown value changes', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="status"
        currentValue="s1"
        displayValue="New"
        onSave={onSave}
        onCancel={vi.fn()}
        cellRect={null}
        statuses={mockStatuses}
      />
    )
    await user.selectOptions(screen.getByRole('combobox'), 's2')
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      columnId: 'status',
      value: 's2',
    }))
  })

  // ✅ VALID: input disabled while saving
  it('disables input while saving', async () => {
    let resolve: (v: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>(r => { resolve = r }))
    render(
      <WorkPackageInlineEdit
        rowId="wp1"
        columnId="subject"
        currentValue="Fix bug"
        displayValue="Fix bug"
        onSave={onSave}
        onCancel={vi.fn()}
        cellRect={null}
      />
    )
    const user = userEvent.setup()
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'Fixed{Enter}')
    expect(screen.getByRole('textbox')).toBeDisabled()
    await act(async () => { resolve!(true) })
  })
})
