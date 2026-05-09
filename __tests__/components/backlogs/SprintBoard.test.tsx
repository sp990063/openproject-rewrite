import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SprintBoard } from '@/components/backlogs/SprintBoard'

// Mock BEFORE import
vi.mock('@/lib/hooks/useBacklogs', () => ({
  useSprintBoard: vi.fn(),
  useMoveWorkPackage: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
}))

// Import AFTER mock
import { useSprintBoard } from '@/lib/hooks/useBacklogs'

describe('SprintBoard', () => {
  it('renders all four columns', () => {
    vi.mocked(useSprintBoard).mockReturnValue({ data: { workPackages: [] }, isLoading: false } as any)
    render(<SprintBoard sprintId="s1" />)
    expect(screen.getByText("New")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    expect(screen.getByText("Resolved")).toBeInTheDocument()
    expect(screen.getByText("Closed")).toBeInTheDocument()
  })

  it('shows loading skeleton when loading', () => {
    vi.mocked(useSprintBoard).mockReturnValue({ data: undefined, isLoading: true } as any)
    const { container } = render(<SprintBoard sprintId="s1" />)
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument()
  })

  it('renders work packages in correct columns', () => {
    vi.mocked(useSprintBoard).mockReturnValue({
      data: {
        workPackages: [
          { id: 'wp1', subject: 'Task 1', statusId: 'NEW', storyPoints: 3, assignee: { name: 'Alice' } },
          { id: 'wp2', subject: 'Task 2', statusId: 'IN_PROGRESS', storyPoints: 5, assignee: null },
        ],
      },
      isLoading: false,
    } as any)
    render(<SprintBoard sprintId="s1" />)
    expect(screen.getByText("Task 1")).toBeInTheDocument()
    expect(screen.getByText("3 pts")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Task 2")).toBeInTheDocument()
    expect(screen.getByText("5 pts")).toBeInTheDocument()
  })

  it('shows empty state message', () => {
    vi.mocked(useSprintBoard).mockReturnValue({ data: { workPackages: [] }, isLoading: false } as any)
    render(<SprintBoard sprintId="s1" />)
    const emptyCols = screen.getAllByText("No items")
    expect(emptyCols.length).toBe(4)
  })
})
