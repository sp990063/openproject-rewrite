import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSprints, useCreateSprint, useMoveWorkPackage, useBurndown } from '@/lib/hooks/useBacklogs'
import { ReactNode } from 'react'

vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn(() => Promise.resolve({ user: { id: '1', isSystemAdmin: false } })) }))

const queryClient = new QueryClient()
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('useBacklogs', () => {
  beforeEach(() => { queryClient.clear() })

  describe('useSprints', () => {
    it('returns initial loading state', () => {
      const { result } = renderHook(() => useSprints('proj1'), { wrapper })
      expect(result.current.isLoading).toBe(true)
    })
  })

  describe('useCreateSprint', () => {
    it('has mutate function', () => {
      const { result } = renderHook(() => useCreateSprint(), { wrapper })
      expect(typeof result.current.mutate).toBe('function')
    })

    it('has mutateAsync function', () => {
      const { result } = renderHook(() => useCreateSprint(), { wrapper })
      expect(typeof result.current.mutateAsync).toBe('function')
    })
  })

  describe('useMoveWorkPackage', () => {
    it('has mutate function', () => {
      const { result } = renderHook(() => useMoveWorkPackage(), { wrapper })
      expect(typeof result.current.mutate).toBe('function')
    })
  })

  describe('useBurndown', () => {
    it('returns undefined data for null sprintId', () => {
      const { result } = renderHook(() => useBurndown(null), { wrapper })
      expect(result.current.data).toBeUndefined()
    })
  })
})
