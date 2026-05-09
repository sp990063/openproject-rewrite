import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ─── Imports of components under test ─────────────────────────────────────────
import { WikiEditor } from '@/components/wiki/WikiEditor'

// ─── WikiEditor ────────────────────────────────────────────────────────────────

describe('WikiEditor', () => {
  const defaultProps = {
    initialTitle: 'Initial Title',
    initialContent: 'Initial content',
    onSave: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ✅ VALID: renders title input with initial value
  it('renders title input with initial value', () => {
    render(<WikiEditor {...defaultProps} />)
    const input = screen.getByPlaceholderText('Page title...') as HTMLInputElement
    expect(input.value).toBe('Initial Title')
  })

  // ✅ VALID: renders textarea with initial content
  it('renders textarea with initial content', () => {
    render(<WikiEditor {...defaultProps} />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('Initial content')
  })

  // ✅ VALID: renders Edit and Preview toolbar buttons
  it('renders Edit and Preview toolbar buttons', () => {
    render(<WikiEditor {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
  })

  // ✅ VALID: Edit button is active by default
  it('Edit button is active by default', () => {
    render(<WikiEditor {...defaultProps} />)
    const editBtn = screen.getByRole('button', { name: 'Edit' })
    expect(editBtn.className).toContain('bg-gray-100')
  })

  // ✅ VALID: clicking Preview shows preview pane
  it('shows preview pane when Preview is clicked', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('Initial content')).toBeInTheDocument()
  })

  // ✅ VALID: clicking Edit shows textarea again
  it('shows textarea when Edit is clicked after Preview', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    expect(textarea).toBeInTheDocument()
  })

  // ✅ VALID: Save button is disabled when title is empty
  it('Save button is disabled when title is empty', () => {
    render(<WikiEditor {...defaultProps} initialTitle="" />)
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()
  })

  // ✅ VALID: Save button is enabled when title is present
  it('Save button is enabled when title has content', () => {
    render(<WikiEditor {...defaultProps} />)
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).not.toBeDisabled()
  })

  // ✅ VALID: Cancel button calls onCancel
  it('Cancel button calls onCancel', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  // ✅ VALID: Save button calls onSave with title and content
  it('Save button calls onSave with title and content', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(defaultProps.onSave).toHaveBeenCalledWith({
      title: 'Initial Title',
      content: 'Initial content',
    })
  })

  // ✅ VALID: onSave is called with trimmed title
  it('onSave is called with trimmed title', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} initialTitle="  Spaced Title  " />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(defaultProps.onSave).toHaveBeenCalledWith({
      title: 'Spaced Title',
      content: 'Initial content',
    })
  })

  // ✅ VALID: title input can be edited
  it('title input can be edited', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    const input = screen.getByPlaceholderText('Page title...')
    await user.clear(input)
    await user.type(input, 'New Title')
    expect(input).toHaveValue('New Title')
  })

  // ✅ VALID: textarea content can be edited
  it('textarea content can be edited', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    await user.clear(textarea)
    await user.type(textarea, 'New content')
    expect(textarea).toHaveValue('New content')
  })

  // ✅ VALID: Ctrl+Enter saves the content
  it('Ctrl+Enter saves the content', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    await user.click(textarea)
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(defaultProps.onSave).toHaveBeenCalled()
  })

  // ✅ VALID: Escape cancels editing
  it('Escape cancels editing', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    await user.click(textarea)
    await user.keyboard('{Escape}')
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  // ✅ VALID: Enter in title input focuses textarea
  it('Enter in title input focuses textarea', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} />)
    const titleInput = screen.getByPlaceholderText('Page title...')
    await user.click(titleInput)
    await user.keyboard('{Enter}')
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    expect(document.activeElement).toBe(textarea)
  })

  // ✅ VALID: isSaving=true shows "Saving..." text
  it('shows Saving text when isSaving is true', () => {
    render(<WikiEditor {...defaultProps} isSaving={true} />)
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })

  // ✅ EDGE CASE: shows Saving state when isSaving=true
  it('shows Saving... state when isSaving is true', () => {
    render(<WikiEditor {...defaultProps} isSaving={true} />)
    // Verify isSaving state renders Saving... text
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    // Verify inputs are disabled in saving state
    const inputs = document.querySelectorAll('input, textarea')
    inputs.forEach(input => expect(input).toBeDisabled())
  })

  // ✅ VALID: Cancel button is disabled when isSaving is true
  it('Cancel button is disabled when isSaving is true', () => {
    render(<WikiEditor {...defaultProps} isSaving={true} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  // ✅ VALID: textarea is disabled when isSaving is true
  it('textarea is disabled when isSaving is true', () => {
    render(<WikiEditor {...defaultProps} isSaving={true} />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    expect(textarea).toBeDisabled()
  })

  // ✅ VALID: title input is disabled when isSaving is true
  it('title input is disabled when isSaving is true', () => {
    render(<WikiEditor {...defaultProps} isSaving={true} />)
    expect(screen.getByPlaceholderText('Page title...')).toBeDisabled()
  })

  // ✅ VALID: isNew=true auto-focuses title input
  it('auto-focuses title input when isNew is true', () => {
    render(<WikiEditor {...defaultProps} isNew={true} />)
    const input = screen.getByPlaceholderText('Page title...')
    expect(document.activeElement).toBe(input)
  })

  // ✅ VALID: shows placeholder text in preview when content is empty
  it('shows placeholder text in preview when content is empty', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} initialContent="" />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('Nothing to preview')).toBeInTheDocument()
  })

  // ✅ VALID: Save does not trigger when title is only whitespace
  it('does not call onSave when title is only whitespace', async () => {
    const user = userEvent.setup()
    render(<WikiEditor {...defaultProps} initialTitle="   " />)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  // ✅ EDGE CASE: renders without crashing when onSave rejects
  it('renders without crashing when onSave rejects', async () => {
    const failingSave = vi.fn().mockRejectedValue(new Error('Save failed'))
    render(<WikiEditor {...defaultProps} onSave={failingSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    // Should not throw - error is caught internally
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  // ✅ VALID: placeholder text is shown in textarea
  it('shows placeholder text in textarea', () => {
    render(<WikiEditor {...defaultProps} initialContent="" />)
    const textboxes = screen.getAllByRole('textbox')
    const textarea = textboxes.find(el => el.tagName === 'TEXTAREA')!
    expect(textarea).toHaveAttribute('placeholder', expect.stringContaining('Write your wiki content'))
  })

  // ✅ VALID: keyboard shortcut hints shown in help text
  it('shows keyboard shortcut hints', () => {
    render(<WikiEditor {...defaultProps} />)
    expect(screen.getByText('Ctrl+Enter to save · Esc to cancel')).toBeInTheDocument()
  })

  // ✅ VALID: Markdown supported hint shown
  it('shows Markdown supported hint', () => {
    render(<WikiEditor {...defaultProps} />)
    expect(screen.getByText('Markdown supported')).toBeInTheDocument()
  })
})
