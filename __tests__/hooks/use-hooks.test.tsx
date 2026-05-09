import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Shared fetch mock helpers ─────────────────────────────────────────────────
type MockFetch = {
  url: string
  init?: RequestInit
  resolve: (data: unknown) => void
  reject: (err: Error) => void
}

let pendingFetches: MockFetch[] = []

const mockFetch = (url: string, init?: RequestInit): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const matched = pendingFetches.find(m => m.url === url)
    if (matched) {
      pendingFetches = pendingFetches.filter(m => m !== matched)
      matched.resolve({ ok: true, json: () => Promise.resolve(matched.resolve(matched.url)), status: 200 } as Response)
    } else {
      reject(new Error(`No mock for: ${url}`))
    }
  })
}

// Global fetch mock — replaced by per-test setup
const originalFetch = global.fetch
beforeEach(() => {
  pendingFetches = []
  global.fetch = vi.fn(mockFetch) as unknown as typeof fetch
})
afterEach(() => {
  global.fetch = originalFetch
  pendingFetches = []
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

// ─── use-wip-limits ──────────────────────────────────────────────────────────

describe('use-wip-limits', () => {
  // ─── useWipLimits ────────────────────────────────────────────────────────────

  it('useWipLimits fetches wip-limits from correct URL', async () => {
    const { useWipLimits } = await import('@/hooks/use-wip-limits')
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        if (url === '/api/projects/prj1/wip-limits') {
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve([{ statusId: 's1', limit: 3 }]),
          } as Response)
        }
        return originalFetch(url)
      }
    )
    const { result } = renderHook(() => useWipLimits('prj1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('useWipLimits does not fetch when projectId is empty', async () => {
    const { useWipLimits } = await import('@/hooks/use-wip-limits')
    const { result } = renderHook(() => useWipLimits(''), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
  })

  // ─── useUpdateWipLimit ───────────────────────────────────────────────────────

  it('useUpdateWipLimit calls PATCH with correct body', async () => {
    const { useUpdateWipLimit } = await import('@/hooks/use-wip-limits')
    const { result } = renderHook(() => useUpdateWipLimit('prj1'), { wrapper: createWrapper() })

    // Spy on fetch
    let capturedRequest: RequestInit | undefined
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ statusId: 's1', limit: 5 }),
        } as Response)
      }
    )

    let mutationResult: unknown
    result.current.mutateAsync({ statusId: 's1', limit: 5 }).then(r => { mutationResult = r })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedRequest?.method).toBe('PATCH')
    expect(capturedRequest?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(capturedRequest?.body as string)).toEqual({ statusId: 's1', limit: 5 })
  })

  it('useUpdateWipLimit updates cache on success', async () => {
    const { useWipLimits, useUpdateWipLimit } = await import('@/hooks/use-wip-limits')
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/wip-limits')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ statusId: 's1', limit: 3 }]),
        } as Response)
      }
      return originalFetch(url)
    })

    const { result: limitResult } = renderHook(() => useWipLimits('prj1'), { wrapper: createWrapper() })
    await waitFor(() => expect(limitResult.current.isSuccess).toBe(true))

    const { result: updateResult } = renderHook(() => useUpdateWipLimit('prj1'), { wrapper: createWrapper() })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, _init?: RequestInit) =>
        Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ statusId: 's1', limit: 5 }),
        } as Response)
    )

    await updateResult.current.mutateAsync({ statusId: 's1', limit: 5 })
    await waitFor(() => expect(updateResult.current.isSuccess).toBe(true))
  })
})

// ─── use-projects ─────────────────────────────────────────────────────────────

describe('use-projects', () => {
  beforeEach(() => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/api/projects') {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([
            { id: 'prj1', name: 'Alpha', identifier: 'alpha', description: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          ]),
        } as Response)
      }
      return originalFetch(url)
    })
  })

  it('projects query succeeds and returns data', async () => {
    const { useProjects } = await import('@/hooks/use-projects')
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.projects.isSuccess).toBe(true))
    expect(result.current.projects.data).toHaveLength(1)
  })

  it('createProject mutation calls POST with correct body', async () => {
    const { useProjects } = await import('@/hooks/use-projects')
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() })

    let capturedRequest: RequestInit | undefined
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true, status: 201,
          json: () => Promise.resolve({ id: 'prj2', name: 'Beta', identifier: 'beta', description: null, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        } as Response)
      }
    )

    await result.current.createProject.mutateAsync({ name: 'Beta', identifier: 'beta' })
    await waitFor(() => expect(result.current.createProject.isSuccess).toBe(true))
    expect(capturedRequest?.method).toBe('POST')
    expect(capturedRequest?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(capturedRequest?.body as string)).toEqual({ name: 'Beta', identifier: 'beta' })
  })

  it('updateProject mutation calls PATCH with partial data', async () => {
    const { useProjects } = await import('@/hooks/use-projects')
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() })

    let capturedRequest: RequestInit | undefined
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ id: 'prj1', name: 'Alpha Updated', identifier: 'alpha', status: 'on_hold', description: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        } as Response)
      }
    )

    await result.current.updateProject.mutateAsync({ id: 'prj1', data: { name: 'Alpha Updated', status: 'on_hold' } })
    await waitFor(() => expect(result.current.updateProject.isSuccess).toBe(true))
    expect(capturedRequest?.method).toBe('PATCH')
    expect(JSON.parse(capturedRequest?.body as string)).toEqual({ name: 'Alpha Updated', status: 'on_hold' })
  })

  it('deleteProject mutation calls DELETE', async () => {
    const { useProjects } = await import('@/hooks/use-projects')
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() })

    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({ ok: true, status: 204 } as Response)
      }
    )

    await result.current.deleteProject.mutateAsync('prj1')
    await waitFor(() => expect(result.current.deleteProject.isSuccess).toBe(true))
    expect(capturedUrl).toBe('/api/projects/prj1')
  })
})

// ─── use-work-packages ────────────────────────────────────────────────────────

describe('use-work-packages', () => {
  const mockWpData = [
    { id: 'wp1', subject: 'Task 1', description: null, projectId: 'prj1', typeId: 't1', statusId: 's1', priorityId: 'p1', assigneeId: null, startDate: '2026-06-01', dueDate: null, estimatedHours: null, storyPoints: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ]

  beforeEach(() => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/api/work-packages')) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve(mockWpData),
        } as Response)
      }
      return originalFetch(url)
    })
  })

  it('useWorkPackages fetches without filters', async () => {
    const { useWorkPackages } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useWorkPackages(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.workPackages.isSuccess).toBe(true))
    expect(result.current.workPackages.data).toHaveLength(1)
  })

  it('useWorkPackages passes projectId as query param', async () => {
    const { useWorkPackages } = await import('@/hooks/use-work-packages')
    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        } as Response)
      }
    )
    const { result } = renderHook(() => useWorkPackages({ projectId: 'prj1' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.workPackages.isSuccess).toBe(true))
    expect(capturedUrl).toContain('projectId=prj1')
  })

  it('useWorkPackages passes statusId as comma-joined query param', async () => {
    const { useWorkPackages } = await import('@/hooks/use-work-packages')
    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        } as Response)
      }
    )
    const { result } = renderHook(() => useWorkPackages({ statusId: ['s1', 's2'] }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.workPackages.isSuccess).toBe(true))
    expect(capturedUrl).toContain('statusId=s1%2Cs2')
  })

  it('useWorkPackages passes date range filters', async () => {
    const { useWorkPackages } = await import('@/hooks/use-work-packages')
    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        } as Response)
      }
    )
    const { result } = renderHook(
      () => useWorkPackages({ startDate: { gte: '2026-06-01', lte: '2026-06-30' } }),
      { wrapper: createWrapper() }
    )
    await waitFor(() => expect(result.current.workPackages.isSuccess).toBe(true))
    expect(capturedUrl).toContain('startDateGte=2026-06-01')
    expect(capturedUrl).toContain('startDateLte=2026-06-30')
  })

  it('useWorkPackages passes search param', async () => {
    const { useWorkPackages } = await import('@/hooks/use-work-packages')
    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve([]),
        } as Response)
      }
    )
    const { result } = renderHook(() => useWorkPackages({ search: 'login bug' }), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.workPackages.isSuccess).toBe(true))
    expect(capturedUrl).toContain('search=login+bug')
  })

  it('useCreateWorkPackage calls POST and returns created wp', async () => {
    const { useCreateWorkPackage } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useCreateWorkPackage(), { wrapper: createWrapper() })

    const newWp = { id: 'wp99', subject: 'New task', description: null, projectId: 'prj1', typeId: 't1', statusId: 's1', priorityId: 'p1', assigneeId: null, startDate: null, dueDate: null, estimatedHours: null, storyPoints: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, _init?: RequestInit) =>
        Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(newWp) } as Response)
    )

    const created = await result.current.mutateAsync({ projectId: 'prj1', subject: 'New task', statusId: 's1' })
    expect(created.id).toBe('wp99')
  })

  it('useDeleteWorkPackage calls DELETE with correct id', async () => {
    const { useDeleteWorkPackage } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useDeleteWorkPackage(), { wrapper: createWrapper() })

    let capturedUrl = ''
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        capturedUrl = url
        return Promise.resolve({ ok: true, status: 204 } as Response)
      }
    )

    await result.current.mutateAsync('wp1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).toBe('/api/work-packages/wp1')
  })

  it('useWorkPackage fetches single wp by id', async () => {
    const { useWorkPackage } = await import('@/hooks/use-work-packages')
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        if (url.includes('/api/work-packages/wp1')) {
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve(mockWpData[0]),
          } as Response)
        }
        return originalFetch(url)
      }
    )
    const { result } = renderHook(() => useWorkPackage('wp1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('wp1')
  })

  it('useWorkPackage does not fetch when id is undefined', async () => {
    const { useWorkPackage } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useWorkPackage(undefined), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
  })

  it('useWorkPackageActivities fetches activities for wp', async () => {
    const { useWorkPackageActivities } = await import('@/hooks/use-work-packages')
    const activities = [{ id: 'a1', activityType: 'comment', message: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        if (url.includes('/activities')) {
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve(activities),
          } as Response)
        }
        return originalFetch(url)
      }
    )
    const { result } = renderHook(() => useWorkPackageActivities('wp1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('useWorkPackageRelations fetches relations for wp', async () => {
    const { useWorkPackageRelations } = await import('@/hooks/use-work-packages')
    const relations = [{ id: 'r1', fromId: 'wp1', toId: 'wp2', relationType: 'blocks', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (url: string) => {
        if (url.includes('/relations')) {
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve(relations),
          } as Response)
        }
        return originalFetch(url)
      }
    )
    const { result } = renderHook(() => useWorkPackageRelations('wp1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('useCreateRelation calls POST with relation data', async () => {
    const { useCreateRelation } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useCreateRelation(), { wrapper: createWrapper() })

    let capturedRequest: RequestInit | undefined
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true, status: 201,
          json: () => Promise.resolve({ id: 'r1', fromId: 'wp1', toId: 'wp2', relationType: 'blocks', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
        } as Response)
      }
    )

    await result.current.mutateAsync({ fromId: 'wp1', toId: 'wp2', relationType: 'blocks' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedRequest?.method).toBe('POST')
    expect(JSON.parse(capturedRequest?.body as string)).toEqual({ fromId: 'wp1', toId: 'wp2', relationType: 'blocks' })
  })

  it('useReorderWorkPackage calls POST with wp id and position', async () => {
    const { useReorderWorkPackage } = await import('@/hooks/use-work-packages')
    const { result } = renderHook(() => useReorderWorkPackage(), { wrapper: createWrapper() })

    let capturedRequest: RequestInit | undefined
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_url: string, init?: RequestInit) => {
        capturedRequest = init
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ id: 'wp1', position: 3 }),
        } as Response)
      }
    )

    await result.current.mutateAsync({ workPackageId: 'wp1', position: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedRequest?.method).toBe('POST')
    expect(JSON.parse(capturedRequest?.body as string)).toEqual({ workPackageId: 'wp1', position: 3 })
  })
})
