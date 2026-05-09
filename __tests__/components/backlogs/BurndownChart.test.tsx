import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BurndownChart } from '@/components/backlogs/BurndownChart'

vi.mock('@/lib/hooks/useBacklogs', () => ({
  useBurndown: vi.fn(),
}))

import { useBurndown } from '@/lib/hooks/useBacklogs'

describe('BurndownChart', () => {
  it('shows placeholder when no data', () => {
    vi.mocked(useBurndown).mockReturnValue({ data: { burndown: [] }, isLoading: false } as any)
    render(<BurndownChart sprintId="s1" />)
    expect(screen.getByText(/Record daily progress/)).toBeInTheDocument()
  })

  it('renders SVG when data available', () => {
    vi.mocked(useBurndown).mockReturnValue({
      data: {
        burndown: [
          { date: '2026-01-01', remaining: 40, ideal: 40 },
          { date: '2026-01-02', remaining: 35, ideal: 37.14 },
          { date: '2026-01-03', remaining: 28, ideal: 34.29 },
        ],
      },
      isLoading: false,
    } as any)
    const { container } = render(<BurndownChart sprintId="s1" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Ideal')).toBeInTheDocument()
  })
})
