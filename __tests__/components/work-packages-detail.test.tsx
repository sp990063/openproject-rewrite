import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubjectInlineEdit } from '@/components/work-packages/detail/SubjectInlineEdit'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import React from 'react'

// ─── SubjectInlineEdit ─────────────────────────────────────────────────────────

describe('SubjectInlineEdit', () => {
  it('renders subject text', () => {
    render(<SubjectInlineEdit subject="Fix login bug" onSave={vi.fn()} />)
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })

  it('enters edit mode on double-click', async () => {
    const user = userEvent.setup()
    render(<SubjectInlineEdit subject="Fix login bug" onSave={vi.fn()} />)
    await user.dblClick(screen.getByText('Fix login bug'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onSave with trimmed value on Enter', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SubjectInlineEdit subject="Fix login bug" onSave={onSave} />)

    await user.dblClick(screen.getByText('Fix login bug'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New subject{Enter}')

    expect(onSave).toHaveBeenCalledWith('New subject')
  })

  it('does not call onSave if value is unchanged', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SubjectInlineEdit subject="Fix login bug" onSave={onSave} />)

    await user.dblClick(screen.getByText('Fix login bug'))
    await user.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
  })

  it('reverts to original on Escape', async () => {
    const user = userEvent.setup()
    render(<SubjectInlineEdit subject="Fix login bug" onSave={vi.fn()} />)

    await user.dblClick(screen.getByText('Fix login bug'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Changed{Escape}')

    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })

  it('does not save if subject becomes empty', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SubjectInlineEdit subject="Fix login bug" onSave={onSave} />)

    await user.dblClick(screen.getByText('Fix login bug'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Fix login bug')).toBeInTheDocument()
  })
})

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────

describe('ErrorBoundary', () => {
  const ErrorChild = ({ throwError = false }: { throwError?: boolean }) => {
    if (throwError) throw new Error('Test error')
    return <div>Normal render</div>
  }

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ErrorChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Normal render')).toBeInTheDocument()
  })

  it('catches and displays error state', () => {
    render(
      <ErrorBoundary label="TestBoundary">
        <ErrorChild throwError />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('shows component label in error state', () => {
    render(
      <ErrorBoundary label="WorkPackageBoard">
        <ErrorChild throwError />
      </ErrorBoundary>
    )
    expect(screen.getByText('Component: WorkPackageBoard')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ErrorChild throwError />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn()
    render(
      <ErrorBoundary onError={onError}>
        <ErrorChild throwError />
      </ErrorBoundary>
    )
    expect(onError).toHaveBeenCalledOnce()
    const [error, resetFn] = onError.mock.calls[0]
    expect(error.message).toBe('Test error')
    expect(typeof resetFn).toBe('function')
  })
})
