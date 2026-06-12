// frontend/test/unit/query.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryClient } from '../../query.js'

describe('queryClient', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  it('fetchQuery calls fetcher and caches result', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1, name: 'X' })
    const result = await queryClient.fetchQuery(['test', 1], fetcher, { staleTime: 60_000 })
    expect(result).toEqual({ id: 1, name: 'X' })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Second call within staleTime should use cache
    const result2 = await queryClient.fetchQuery(['test', 1], fetcher, { staleTime: 60_000 })
    expect(result2).toEqual({ id: 1, name: 'X' })
    expect(fetcher).toHaveBeenCalledTimes(1)  // not called again
  })

  it('setQueryData writes optimistically', () => {
    queryClient.setQueryData(['opt', 1], { hello: 'world' })
    expect(queryClient.getQueryData(['opt', 1])).toEqual({ hello: 'world' })
  })

  it('setQueryData with updater function', () => {
    queryClient.setQueryData(['opt', 2], [1, 2, 3])
    queryClient.setQueryData(['opt', 2], (curr) => [...curr, 4])
    expect(queryClient.getQueryData(['opt', 2])).toEqual([1, 2, 3, 4])
  })

  it('invalidate marks entry stale (re-fetches)', async () => {
    let count = 0
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(++count))
    await queryClient.fetchQuery(['inv', 1], fetcher, { staleTime: 60_000 })
    expect(count).toBe(1)
    queryClient.invalidate(['inv', 1])
    await queryClient.fetchQuery(['inv', 1], fetcher, { staleTime: 60_000 })
    expect(count).toBe(2)
  })

  it('removeQuery drops cache', async () => {
    const fetcher = vi.fn().mockResolvedValue('data')
    await queryClient.fetchQuery(['rem', 1], fetcher)
    expect(queryClient.getQueryData(['rem', 1])).toBe('data')
    queryClient.removeQuery(['rem', 1])
    expect(queryClient.getQueryData(['rem', 1])).toBeUndefined()
  })

  it('dedup concurrent fetches of same key', async () => {
    let count = 0
    const fetcher = vi.fn().mockImplementation(() =>
      new Promise((res) => setTimeout(() => res(++count), 10))
    )
    const [a, b, c] = await Promise.all([
      queryClient.fetchQuery(['dedup', 1], fetcher),
      queryClient.fetchQuery(['dedup', 1], fetcher),
      queryClient.fetchQuery(['dedup', 1], fetcher),
    ])
    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(c).toBe(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
