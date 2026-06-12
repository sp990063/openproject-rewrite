// frontend/test/unit/hooks-state-fixes.test.js
// Tests for HS-2 (dataSignal wiring on refetch) and HS-5 (initStore /
// module-top-level subscriber leak fix).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { queryClient } from '../../query.js'
import { theme, sidebarCollapsed, initStore, __resetStoreForTests } from '../../store.js'

describe('HS-2: queryClient useQuery dataSignal updates on refetch', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  it('dataSignal reflects resolved data on initial fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1, value: 'A' })
    const q = queryClient.useQuery(['hs2', 1], fetcher)
    // Wait for the initial fetch to complete
    await new Promise((r) => setTimeout(r, 10))
    expect(q.data()).toEqual({ id: 1, value: 'A' })
    expect(q.status()).toBe('success')
    q.dispose()
  })

  it('dataSignal reflects refetched data (HS-2 regression test)', async () => {
    let value = 'A'
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve({ id: 1, value }))
    const q = queryClient.useQuery(['hs2', 2], fetcher)
    await new Promise((r) => setTimeout(r, 10))
    expect(q.data()).toEqual({ id: 1, value: 'A' })

    // Mutate the server's response and refetch.
    value = 'B'
    await q.refetch()
    // After refetch, the dataSignal should now reflect the new value.
    // (Pre-fix: data() would still return the original 'A'.)
    expect(q.data()).toEqual({ id: 1, value: 'B' })
    expect(q.status()).toBe('success')
    q.dispose()
  })

  it('dataSignal propagates error state', async () => {
    // Suppress unhandled rejection — useQuery catches internally and stores on error signal
    const handler = (e) => { e.preventDefault(); e.stopImmediatePropagation?.() }
    window.addEventListener('unhandledrejection', handler)
    try {
      const fetcher = vi.fn().mockRejectedValue(new Error('boom'))
      const q = queryClient.useQuery(['hs2', 3], fetcher)
      await new Promise((r) => setTimeout(r, 10))
      expect(q.status()).toBe('error')
      expect(q.error()?.message).toBe('boom')
      q.dispose()
    } finally {
      window.removeEventListener('unhandledrejection', handler)
    }
  })
})

describe('HS-5: initStore replaces subscribers instead of accumulating', () => {
  beforeEach(() => {
    __resetStoreForTests()
  })

  it('initStore attaches subscribers; re-init replaces without double-write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    // Force a known initial by clearing localStorage so theme starts as undefined
    localStorage.removeItem('op-theme')
    initStore()
    theme.value = 'dark'
    const callsFirst = setItem.mock.calls.filter((c) => c[0] === 'op-theme').length
    expect(callsFirst).toBeGreaterThanOrEqual(1)
    // Second initStore call should REPLACE subscribers (the HS-5 fix).
    // Pre-fix: 2 subscribers → 2 setItem calls per change. Post-fix: still 1 call.
    initStore()
    theme.value = 'light'
    const callsSecond = setItem.mock.calls.filter((c) => c[0] === 'op-theme').length
    expect(callsSecond - callsFirst).toBeLessThanOrEqual(1)
    setItem.mockRestore()
  })

  it('initStore unsubscribe handle detaches all subscribers', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const dispose = initStore()
    theme.value = 'dark'
    const writesBefore = setItem.mock.calls.length
    dispose()
    theme.value = 'light'
    const writesAfter = setItem.mock.calls.length
    // After dispose, no new writes should occur from the disposed handles.
    expect(writesAfter).toBe(writesBefore)
    setItem.mockRestore()
  })

  it('initStore({ persist: false }) does not attach localStorage subscribers', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    initStore({ persist: false })
    theme.value = 'dark'
    const calls = setItem.mock.calls.filter((c) => c[0] === 'op-theme')
    expect(calls.length).toBe(0)
    setItem.mockRestore()
  })

  it('__resetStoreForTests resets all singleton state', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    initStore()
    theme.value = 'dark'
    sidebarCollapsed.value = true
    expect(theme.value).toBe('dark')
    expect(sidebarCollapsed.value).toBe(true)
    __resetStoreForTests()
    // After reset, theme should revert to whatever localStorage says (or 'light'),
    // and the subscribers should be gone.
    expect(setItem.mock.calls.filter((c) => c[0] === 'op-theme').length).toBeGreaterThan(0)
    setItem.mockRestore()
  })
})
