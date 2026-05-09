import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Mock hooks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useTimeEntryMutations', () => ({
  useLogTime: vi.fn(),
}))

// ─── Import component under test ─────────────────────────────────────────────
import { LogTimeDialog } from '@/components/time-tracking/LogTimeDialog'
import { useLogTime } from '@/hooks/useTimeEntryMutations'

// ─── LogTimeDialog ────────────────────────────────────────────────────────────

describe('LogTimeDialog', () => {
  const mockWorkPackage = { id: 'wp1', subject: 'Implement user authentication' }
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: renders modal with form fields
  it('renders modal with hours, date, and comment fields', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    expect(screen.getByLabelText('Hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    expect(screen.getByLabelText(/comment/i)).toBeInTheDocument()
  })

  // ✅ VALID: shows work package subject in title
  it('shows work package subject in modal title', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    expect(screen.getByText(/Log Time: Implement user authentication/i)).toBeInTheDocument()
  })

  // ✅ VALID: submit button is disabled when hours is empty
  it('submit button is disabled when hours field is empty', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const submitButton = screen.getByRole('button', { name: /log time/i })
    expect(submitButton).toBeDisabled()
  })

  // ✅ VALID: submit button is disabled when hours is zero or negative
  it('submit button is disabled when hours is zero', async () => {
    const user = userEvent.setup()
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const hoursInput = screen.getByLabelText('Hours')
    await user.clear(hoursInput)
    await user.type(hoursInput, '0')

    const submitButton = screen.getByRole('button', { name: /log time/i })
    expect(submitButton).toBeDisabled()
  })

  // ✅ VALID: submit button is enabled when valid hours entered
  it('submit button is enabled when valid positive hours are entered', async () => {
    const user = userEvent.setup()
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const hoursInput = screen.getByLabelText('Hours')
    await user.type(hoursInput, '2.5')

    const submitButton = screen.getByRole('button', { name: /log time/i })
    expect(submitButton).not.toBeDisabled()
  })

  // ✅ VALID: submit calls useLogTime with correct data
  it('calls useLogTime with correct workPackageId, hours, date, and comment on submit', async () => {
    const user = userEvent.setup()
    const logTimeMock = vi.fn().mockResolvedValue({ data: { entry: {} } })
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: logTimeMock,
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    await user.type(screen.getByLabelText('Hours'), '3')
    await user.type(screen.getByLabelText(/comment/i), 'Worked on OAuth integration')

    await user.click(screen.getByRole('button', { name: /log time/i }))

    expect(logTimeMock).toHaveBeenCalledWith({
      workPackageId: 'wp1',
      hours: 3,
      spentOn: expect.any(String),
      comment: 'Worked on OAuth integration',
    })
  })

  // ✅ VALID: calls onClose when Cancel is clicked
  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  // ✅ VALID: onClose is called after successful submit
  it('calls onClose after successful submission', async () => {
    const user = userEvent.setup()
    const logTimeMock = vi.fn().mockResolvedValue({ data: { entry: {} } })
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: logTimeMock,
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    await user.type(screen.getByLabelText('Hours'), '1.5')
    await user.click(screen.getByRole('button', { name: /log time/i }))

    // Wait for async operation
    await vi.waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ✅ VALID: submit button shows loading state when pending
  it('submit button shows loading state when mutation is pending', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const submitButton = screen.getByRole('button', { name: /log time/i })
    expect(submitButton).toBeDisabled()
  })

  // ✅ VALID: hours input has correct HTML5 number attributes
  it('hours input has min, max, and step attributes', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const hoursInput = screen.getByLabelText('Hours') as HTMLInputElement
    expect(hoursInput.min).toBe('0.25')
    expect(hoursInput.max).toBe('24')
    expect(hoursInput.step).toBe('0.25')
  })

  // ✅ VALID: date input has today's date as default value
  it('date input defaults to today', () => {
    vi.mocked(useLogTime).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    render(<LogTimeDialog workPackage={mockWorkPackage} onClose={mockOnClose} />)

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement
    const today = new Date().toISOString().split('T')[0]
    expect(dateInput.value).toBe(today)
  })
})
