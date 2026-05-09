import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TwoFactorSetupDialog } from '@/components/auth/TwoFactorSetupDialog'

describe('TwoFactorSetupDialog', () => {
  it('renders method selection when open', () => {
    render(<TwoFactorSetupDialog open onClose={vi.fn()} />)
    expect(screen.getByText(/Authenticator App/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<TwoFactorSetupDialog open={false} onClose={vi.fn()} />)
    expect(screen.queryByText(/Authenticator App/)).not.toBeInTheDocument()
  })

  it('has enabled 2FA button when open', () => {
    render(<TwoFactorSetupDialog open onClose={vi.fn()} />)
    const btn = screen.getByRole('button', { name: /Authenticator App/ })
    expect(btn).not.toBeDisabled()
  })
})
