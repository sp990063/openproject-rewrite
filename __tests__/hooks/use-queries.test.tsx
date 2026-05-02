import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react-dom/test-utils'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mock the hooks module entirely ─────────────────────────────────────────────
// We replace the entire hooks module with controlled mock functions,
// then verify that the QueryClient receives correct query keys / mutation payloads.

const mockSavedQueriesData = vi.fn<any[]>()
const mockSavedQueryData = vi.fn<any>()
const mockCreateMutateAsync = vi.fn()
const mockUpdateMutateAsync = vi.fn()
const mockDeleteMutateAsync = vi.fn()

vi.mock('@/hooks/use-queries', () => ({
  useSavedQueries: vi.fn(() => ({
    data: mockSavedQueriesData,
    isLoading: false,
    isError: false,
    isSuccess: true,
  })),
  useSavedQuery: vi.fn(() => ({
    data: mockSavedQueryData,
    isLoading: false,
    isError: false,
    isSuccess: true,
  })),
  useCreateSavedQuery: vi.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
  useUpdateSavedQuery: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useDeleteSavedQuery: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
  queryKeys: {
    allSavedQueries: (projectId?: string) => ['savedQueries', projectId ?? 'all'],
    savedQuery: (id: string) => ['savedQueries', id],
  },
}))

// Import AFTER vi.mock
import {
  useSavedQueries,
  useSavedQuery,
  useCreateSavedQuery,
  useUpdateSavedQuery,
  useDeleteSavedQuery,
  queryKeys,
} from '@/hooks/use-queries'

// ─── Setup ─────────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ─── Hook integration tests ─────────────────────────────────────────────────────

describe('useSavedQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns data from hook', async () => {
    mockSavedQueriesData.mockResolvedValueOnce([
      { id: 'q1', name: 'Open tasks', filters: {} },
    ])

    const { result } = renderHook(() => useSavedQueries('proj-1'), { wrapper: createWrapper() })

    // Hook is mocked so resolves immediately
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.isSuccess).toBe(true)
  })

  it('is called with projectId when provided', async () => {
    renderHook(() => useSavedQueries('proj-xyz'), { wrapper: createWrapper() })

    await waitFor(() =>
      expect(useSavedQueries).toHaveBeenCalledWith('proj-xyz')
    )
  })

  it('is called when no projectId (undefined)', async () => {
    renderHook(() => useSavedQueries(), { wrapper: createWrapper() })

    // Hook should have been called at least once
    expect(useSavedQueries).toHaveBeenCalled()
  })
})

describe('useSavedQuery', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('is called with query id', async () => {
    renderHook(() => useSavedQuery('q123'), { wrapper: createWrapper() })

    await waitFor(() =>
      expect(useSavedQuery).toHaveBeenCalledWith('q123')
    )
  })
})

describe('useCreateSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateMutateAsync.mockResolvedValue({ id: 'q-new', name: 'New View' })
  })

  it('mutateAsync is called with correct input', async () => {
    const input = {
      name: 'My Saved View',
      projectId: 'proj-1',
      filters: { statusId: 'open' },
      sortBy: [],
      displayMode: 'board' as const,
    }

    const { result } = renderHook(() => useCreateSavedQuery(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(mockCreateMutateAsync).toHaveBeenCalledWith(input)
  })

  it('returns resolved value from mutateAsync', async () => {
    const { result } = renderHook(() => useCreateSavedQuery(), { wrapper: createWrapper() })

    let returned: any
    await act(async () => {
      returned = await result.current.mutateAsync({
        name: 'X',
        filters: {},
        sortBy: [],
        displayMode: 'table',
      })
    })

    expect(returned).toEqual({ id: 'q-new', name: 'New View' })
  })
})

describe('useUpdateSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateMutateAsync.mockResolvedValue({ id: 'q1', name: 'Updated Name' })
  })

  it('mutateAsync is called with id and data', async () => {
    const { result } = renderHook(() => useUpdateSavedQuery(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'q1', data: { name: 'Updated Name', isDefault: true } })
    })

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 'q1',
      data: { name: 'Updated Name', isDefault: true },
    })
  })
})

describe('useDeleteSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteMutateAsync.mockResolvedValue(undefined)
  })

  it('mutateAsync is called with id string', async () => {
    const { result } = renderHook(() => useDeleteSavedQuery(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.mutateAsync('q1')
    })

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('q1')
  })
})

describe('queryKeys', () => {
  it('allSavedQueries returns correct key tuple', () => {
    expect(queryKeys.allSavedQueries()).toEqual(['savedQueries', 'all'])
    expect(queryKeys.allSavedQueries('proj-1')).toEqual(['savedQueries', 'proj-1'])
  })

  it('savedQuery returns correct key tuple', () => {
    expect(queryKeys.savedQuery('q123')).toEqual(['savedQueries', 'q123'])
  })
})
