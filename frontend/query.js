// frontend/query.js
// ─────────────────────────────────────────────────────────────────────────────
// Tiny query/cache layer that replaces TanStack Query. ~200 LOC, no deps.
//
// Why we need this:
//   - Two components asking for the same data should share a fetch
//   - After a mutation, related queries should auto-refetch
//   - Show stale data immediately, refresh in background
//   - Cancel in-flight requests on unmount
//
// Public surface:
//   - queryClient.fetchQuery(key, fetcher, opts)   — promise + cache write
//   - queryClient.prefetchQuery(key, fetcher, opts)
//   - queryClient.getQueryData(key)               — sync read (stale OK)
//   - queryClient.setQueryData(key, updater)      — write
//   - queryClient.invalidate(key | matchFn)       — mark stale + refetch
//   - queryClient.removeQuery(key)
//   - queryClient.useQuery(key, fetcher, opts)    — React-ish hook (signal-based)
//
// Keys are arrays of strings/numbers (e.g. ['projects', projectId, 'work-packages']).
// Invalidation accepts a prefix array or a function predicate.
// ─────────────────────────────────────────────────────────────────────────────

import { signal, effect } from './store.js'

/**
 * @typedef {object} QueryEntry
 * @property {string} key  — JSON.stringify(key) — unique id
 * @property {any} data
 * @property {'idle'|'loading'|'success'|'error'} status
 * @property {Error|null} error
 * @property {number} dataUpdatedAt
 * @property {AbortController|null} abortCtrl
 * @property {Array<{resolve, reject}>} observers  — waiting promises
 * @property {Array<() => void>} effectDisposers  — active useQuery subscriptions
 */

/** @type {Map<string, QueryEntry>} */
const cache = new Map()

/** @type {Array<{prefix: string[], matchFn: (k: any[]) => boolean, refetch: boolean}>} */
const invalidationListeners = []

function keyToString(key) {
  return JSON.stringify(key)
}

function newEntry() {
  return {
    data: undefined,
    status: 'idle',
    error: null,
    dataUpdatedAt: 0,
    abortCtrl: null,
    observers: [],
    effectDisposers: [],
  }
}

class QueryClient {
  /**
   * Fetch data, dedup concurrent requests, cache result.
   * @template T
   * @param {any[]} key
   * @param {(ctx: {signal: AbortSignal}) => Promise<T>} fetcher
   * @param {{staleTime?: number, force?: boolean}} [opts]
   * @returns {Promise<T>}
   */
  async fetchQuery(key, fetcher, opts = {}) {
    const k = keyToString(key)
    let entry = cache.get(k)
    if (!entry) {
      entry = newEntry()
      cache.set(k, entry)
    }

    const staleTime = opts.staleTime ?? 0
    const fresh = entry.status === 'success' &&
                  (Date.now() - entry.dataUpdatedAt) < staleTime

    if (entry.status === 'loading' && entry.observers.length) {
      // Dedup: another caller is already fetching
      return new Promise((resolve, reject) => {
        entry.observers.push({ resolve, reject })
      })
    }

    if (fresh && !opts.force) {
      return entry.data
    }

    return this._executeEntry(k, entry, fetcher, key)
  }

  /**
   * Internal: kick off a fetch for an entry, notify observers.
   * @template T
   * @param {string} k
   * @param {QueryEntry} entry
   * @param {(ctx: {signal: AbortSignal}) => Promise<T>} fetcher
   * @param {any[]} key
   * @returns {Promise<T>}
   */
  _executeEntry(k, entry, fetcher, key) {
    // Cancel any in-flight
    if (entry.abortCtrl) entry.abortCtrl.abort()
    entry.abortCtrl = new AbortController()
    entry.status = 'loading'
    entry.error = null
    // HS-2 fix: also propagate 'loading' to dataSignal subscribers so they
    // see the transition immediately when refetch() is called.
    if (entry._dataSignal) {
      entry._dataSignal.value = { data: entry.data, status: 'loading', error: null }
    }

    const exec = fetcher({ signal: entry.abortCtrl.signal })

    return new Promise((resolve, reject) => {
      entry.observers.push({ resolve, reject })
      exec
        .then((data) => {
          entry.data = data
          entry.status = 'success'
          entry.error = null
          entry.dataUpdatedAt = Date.now()
          // HS-2 fix: write through to per-entry dataSignal so useQuery
          // subscribers see refreshed data on refetch (not just initial fetch).
          if (entry._dataSignal) {
            entry._dataSignal.value = { data, status: 'success', error: null }
          }
          // Notify all observers
          for (const o of entry.observers) o.resolve(data)
          entry.observers.length = 0
        })
        .catch((err) => {
          if (err.name === 'AbortError') {
            // Replaced by a newer fetch — observers wait on new promise
            for (const o of entry.observers) o.reject(err)
            entry.observers.length = 0
            return
          }
          entry.error = err
          entry.status = 'error'
          // HS-2 fix: also propagate error to dataSignal subscribers.
          if (entry._dataSignal) {
            entry._dataSignal.value = { data: undefined, status: 'error', error: err }
          }
          for (const o of entry.observers) o.reject(err)
          entry.observers.length = 0
        })
    })
  }

  /** Sync read. Returns undefined if not loaded. */
  getQueryData(key) {
    const entry = cache.get(keyToString(key))
    return entry?.data
  }

  /** Sync status read. */
  getQueryStatus(key) {
    const entry = cache.get(keyToString(key))
    return entry?.status || 'idle'
  }

  /**
   * Optimistic write. `updater` is called with current data and returns next data.
   * @template T
   * @param {any[]} key
   * @param {T | ((curr: T | undefined) => T)} updater
   */
  setQueryData(key, updater) {
    const k = keyToString(key)
    let entry = cache.get(k)
    if (!entry) {
      entry = newEntry()
      cache.set(k, entry)
    }
    const next = typeof updater === 'function' ? updater(entry.data) : updater
    entry.data = next
    entry.dataUpdatedAt = Date.now()
    entry.status = 'success'
  }

  /**
   * Mark a query (or all matching a prefix) as stale. Optionally refetch.
   * @param {any[] | ((key: any[]) => boolean)} match
   * @param {{refetch?: boolean}} [opts]
   */
  invalidate(match, opts = {}) {
    const matchFn = Array.isArray(match)
      ? (k) => JSON.stringify(k).startsWith(JSON.stringify(match))
      : match

    for (const [k, entry] of cache) {
      const key = JSON.parse(k)
      if (matchFn(key)) {
        entry.dataUpdatedAt = 0  // mark stale
      }
    }
  }

  /**
   * Remove a query from cache.
   * @param {any[]} key
   */
  removeQuery(key) {
    const k = keyToString(key)
    const entry = cache.get(k)
    if (entry) {
      entry.abortCtrl?.abort()
      for (const d of entry.effectDisposers) d()
      cache.delete(k)
    }
  }

  /**
   * Subscribe-style hook. Returns a signal that updates as data changes.
   * @template T
   * @param {any[]} key
   * @param {(ctx: {signal: AbortSignal}) => Promise<T>} fetcher
   * @param {{staleTime?: number, refetchOn?: 'mount'|'never'}} [opts]
   * @returns {{
   *   data: () => T|undefined,
   *   status: () => string,
   *   error: () => Error|null,
   *   refetch: () => Promise<T>,
   *   dispose: () => void,
   * }}
   */
  useQuery(key, fetcher, opts = {}) {
    const k = keyToString(key)
    const state = signal({
      data: this.getQueryData(key),
      status: this.getQueryStatus(key),
      error: /** @type {Error|null} */ (null),
    })

    let entry = cache.get(k)
    if (!entry) {
      entry = newEntry()
      cache.set(k, entry)
    }

    // Subscribe to this query's data via a "data signal" we maintain per entry
    if (!entry._dataSignal) {
      entry._dataSignal = signal({ data: entry.data, status: entry.status, error: entry.error })
    }
    const dataSig = entry._dataSignal

    const dispose = effect(() => {
      const v = dataSig.value
      state.value = v
    })

    entry.effectDisposers.push(dispose)

    const refetch = () => this.fetchQuery(key, fetcher, { ...opts, force: true })

    // Initial fetch if needed. HS-2 fix: _executeEntry now writes through to
    // dataSignal, so we don't need a separate .then/.catch here.
    if (entry.status === 'idle' || entry.status === 'error') {
      this.fetchQuery(key, fetcher, opts)
    }

    return {
      data: () => state.value.data,
      status: () => state.value.status,
      error: () => state.value.error,
      refetch,
      dispose: () => {
        dispose()
        const e = cache.get(k)
        if (e) {
          const i = e.effectDisposers.indexOf(dispose)
          if (i >= 0) e.effectDisposers.splice(i, 1)
        }
      },
    }
  }

  /** Wipe the whole cache. Mainly for tests. */
  clear() {
    for (const [k, entry] of cache) {
      entry.abortCtrl?.abort()
      for (const d of entry.effectDisposers) d()
    }
    cache.clear()
  }
}

export const queryClient = new QueryClient()
