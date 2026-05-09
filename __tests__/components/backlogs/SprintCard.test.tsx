import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SprintCard } from '@/components/backlogs/SprintCard'
import { addDays, format } from 'date-fns'

const mockSprint = {
  id: 's1',
  projectId: 'p1',
  name: 'Sprint 1',
  status: 'ACTIVE' as const,
  startDate: addDays(new Date(), -7).toISOString(), // started 7 days ago
  endDate: addDays(new Date(), 7).toISOString(),    // ends in 7 days
  capacity: 40,
  velocity: 35,
  sprintMembers: [],
}

describe('SprintCard', () => {
  it('renders sprint name', () => {
    render(<SprintCard sprint={mockSprint} />)
    expect(screen.getByText("Sprint 1")).toBeInTheDocument()
  })

  it('renders ACTIVE badge', () => {
    render(<SprintCard sprint={mockSprint} />)
    expect(screen.getByText("ACTIVE")).toBeInTheDocument()
  })

  it('renders OPEN badge', () => {
    render(<SprintCard sprint={{ ...mockSprint, status: "OPEN" as const }} />)
    expect(screen.getByText("OPEN")).toBeInTheDocument()
  })

  it('renders CLOSED badge', () => {
    render(<SprintCard sprint={{ ...mockSprint, status: "CLOSED" as const }} />)
    expect(screen.getByText("CLOSED")).toBeInTheDocument()
  })

  it('renders capacity', () => {
    render(<SprintCard sprint={mockSprint} />)
    expect(screen.getByText(/Capacity: 40 pts/)).toBeInTheDocument()
  })

  it('renders velocity', () => {
    render(<SprintCard sprint={mockSprint} />)
    expect(screen.getByText(/Velocity: 35 pts/)).toBeInTheDocument()
  })

  it('renders days remaining text', () => {
    render(<SprintCard sprint={mockSprint} />)
    expect(screen.getByText(/days remaining/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<SprintCard sprint={mockSprint} onClick={onClick} />)
    screen.getByText("Sprint 1").click()
    expect(onClick).toHaveBeenCalled()
  })
})
