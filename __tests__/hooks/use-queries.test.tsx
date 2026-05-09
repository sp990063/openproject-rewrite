import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react-dom/test-utils'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import {
  useSavedQueries,
  useSavedQuery,
  useCreateSavedQuery,
  useUpdateSavedQuery,
  useDeleteSavedQuery,
  queryKeys,
} from '@/hooks/use-queries'
import type { SortBy } from '@/types'

// ─── Fetch mock helpers ─────────────────────────────────────────────────────

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSavedQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches from /api/queries when no projectId', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ id: 'q1', name: 'Open tasks', filters: {} }]),
        } as Response)
    )

    const { result } = renderHook(() => useSavedQueries(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('fetches from /api/queries?projectId=... when projectId provided', async () => {
    let capturedUrl = ''
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        } as Response)
      }
    )

    const { result } = renderHook(() => useSavedQueries('proj-xyz'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toBe('/api/queries?projectId=proj-xyz')
  })

  it('throws and sets isError when fetch fails', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => Promise.resolve({ ok: false, status: 500 } as Response)
    )

    const { result } = renderHook(() => useSavedQueries(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches from /api/queries/{id}', async () => {
    let capturedUrl = ''
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'q123', name: 'Test Query', filters: {} }),
        } as Response)
      }
    )

    const { result } = renderHook(() => useSavedQuery('q123'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('q123')
    expect(capturedUrl).toBe('/api/queries/q123')
  })

  it('does not fetch when id is empty', async () => {
    const { result } = renderHook(() => useSavedQuery(''), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useCreateSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls POST /api/queries with correct body', async () => {
    const { result } = renderHook(() => useCreateSavedQuery(), { wrapper: createWrapper() })

    let capturedRequest: RequestInit | undefined
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'q-new', name: 'New View', filters: {} }),
        } as Response)
      }
    )

    const input = {
      name: 'My Saved View',
      projectId: 'proj-1',
      filters: {} as Record<string, unknown>,
      sortBy: [] as SortBy[],
      displayMode: 'board',
    }

    await act(async () => {
      await result.current.mutateAsync(input)
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedRequest?.method).toBe('POST')
    expect(capturedRequest?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(capturedRequest?.body as string)).toMatchObject({ name: 'My Saved View', projectId: 'proj-1' })
  })

  it('returns created query data', async () => {
    const { result } = renderHook(() => useCreateSavedQuery(), { wrapper: createWrapper() })

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'q-new', name: 'New View', filters: {} }),
        } as Response)
    )

    let returned: unknown
    await act(async () => {
      returned = await result.current.mutateAsync({
        name: 'X',
        filters: {},
        sortBy: [],
        displayMode: 'table',
      })
    })

    expect((returned as any).id).toBe('q-new')
  })
})

describe('useUpdateSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls PATCH /api/queries/{id} with partial data', async () => {
    const { result } = renderHook(() => useUpdateSavedQuery(), { wrapper: createWrapper() })

    let capturedUrl = ''
    let capturedRequest: RequestInit | undefined
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string, init?: RequestInit) => {
        capturedUrl = url
        capturedRequest = init
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'q1', name: 'Updated Name', filters: {} }),
        } as Response)
      }
    )

    await act(async () => {
      await result.current.mutateAsync({ id: 'q1', data: { name: 'Updated Name', isDefault: true } })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedUrl).toBe('/api/queries/q1')
    expect(capturedRequest?.method).toBe('PATCH')
    expect(JSON.parse(capturedRequest?.body as string)).toMatchObject({ name: 'Updated Name', isDefault: true })
  })
})

describe('useDeleteSavedQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls DELETE /api/queries/{id}', async () => {
    const { result } = renderHook(() => useDeleteSavedQuery(), { wrapper: createWrapper() })

    let capturedUrl = ''
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({ ok: true, status: 204 } as Response)
      }
    )

    await act(async () => {
      await result.current.mutateAsync('q1')
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(capturedUrl).toBe('/api/queries/q1')
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
