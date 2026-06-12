// frontend/store.js
// ─────────────────────────────────────────────────────────────────────────────
// Tiny reactive store inspired by Preact Signals. ~120 LOC, no deps.
//
// Public surface:
//   - signal(initial)             → { value, subscribe(fn) }
//   - effect(fn)                  → dispose()
//   - computed(fn)                → { value (readonly) }
//   - batch(fn)                   → group updates
//
// Design choice: we use a simple "subscriber Set per signal" model, not
// true dependency tracking via Proxy. Effects re-run on ANY signal they
// read; the .value comparison uses Object.is so unchanged primitives
// don't trigger re-runs. This is "good enough" for an OpenProject-sized
// app and is 100% debuggable (no Proxy magic).
//
// For fine-grained deps, use subscribe() per signal and write your own
// reconciliation. We do that in table.js and friends.
//
// App singletons exported at the bottom:
//   - currentUser, theme, sidebarCollapsed, toasts, pushToast()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signal: a reactive cell.
 * @template T
 */
export class Signal {
  /** @type {T} */
  #value
  /** @type {Set<() => void>} */
  #subs

  /**
   * @param {T} initial
   * @param {{equals?: (a: T, b: T) => boolean}} [opts]
   */
  constructor(initial, opts = {}) {
    this.#value = initial
    this.#subs = new Set()
    this._equals = opts.equals || Object.is
  }

  get value() {
    if (currentEffect) currentEffect.track(this)
    return this.#value
  }

  set value(next) {
    if (this._equals(this.#value, next)) return
    this.#value = next
    if (batchDepth > 0) {
      // Defer until batch commits
      for (const sub of this.#subs) pendingEffects.add(sub)
    } else {
      // Copy to avoid mutation-during-iterate
      for (const sub of [...this.#subs]) sub()
    }
  }

  /** Used by effects to clean up. Internal. */
  _untrack(sub) {
    this.#subs.delete(sub)
  }

  /** Low-level subscribe (for components that don't need dep tracking). */
  subscribe(fn) {
    this.#subs.add(fn)
    return () => this.#subs.delete(fn)
  }
}

/**
 * @template T
 * @param {T} initial
 * @returns {Signal<T>}
 */
export function signal(initial) {
  return new Signal(initial)
}

// ── Effects ────────────────────────────────────────────────────────────────

/** @type {{track: (s: Signal) => void, dispose: () => void} | null} */
let currentEffect = null
let batchDepth = 0
/** @type {Set<() => void>} */
const pendingEffects = new Set()

/**
 * Run fn; re-run whenever any signal read inside .value changes.
 * Returns a dispose() to stop listening.
 * @param {() => void | (() => void)} fn — may return a cleanup function
 * @returns {() => void}
 */
export function effect(fn) {
  let cleanup = null
  /** @type {Set<Signal>} */
  const tracked = new Set()
  let disposed = false

  // Stable wrapper function — this single reference is the subscriber.
  // We re-add it to each signal's subs on every run, then on dispose or
  // next run we _untrack (delete from prior signals).
  const run = () => {
    if (disposed) return
    // Drop old subscriptions before re-running
    for (const s of tracked) s._untrack(run)
    tracked.clear()
    // Run with this effect as the current one
    const prev = currentEffect
    currentEffect = {
      track: (s) => {
        if (tracked.has(s)) return  // already in subs from this run
        tracked.add(s)
        s.subscribe(run)  // re-subscribe (prior run was untracked at top)
      },
    }
    try {
      if (cleanup) { cleanup(); cleanup = null }
      const ret = fn()
      if (typeof ret === 'function') cleanup = ret
    } catch (e) {
      console.error('[effect] threw:', e)
    } finally {
      currentEffect = prev
    }
  }

  run()

  return () => {
    disposed = true
    for (const s of tracked) s._untrack(run)
    if (cleanup) { cleanup(); cleanup = null }
  }
}

/**
 * Computed: derived signal, memoized.
 * @template T
 * @param {() => T} compute
 */
export function computed(compute) {
  const backing = signal(/** @type {T | undefined} */ (undefined))
  effect(() => {
    backing.value = compute()
  })
  return {
    get value() { return backing.value },
    peek() { return backing.value },
  }
}

/**
 * Batch multiple signal updates into one notification.
 * @param {() => void} fn
 */
export function batch(fn) {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      for (const e of pendingEffects) e()
      pendingEffects.clear()
    }
  }
}

// ── App-wide singletons ────────────────────────────────────────────────────

/** Current logged-in user. null = anonymous. */
export const currentUser = signal(null)

/** 'light' or 'dark'. */
export const theme = signal(localStorage.getItem('op-theme') || 'light')
theme.subscribe(t => localStorage.setItem('op-theme', t))

/** Sidebar collapsed. */
export const sidebarCollapsed = signal(localStorage.getItem('op-sidebar') === '1')
sidebarCollapsed.subscribe(v => localStorage.setItem('op-sidebar', v ? '1' : '0'))

/** Toast queue. */
export const toasts = signal(/** @type {Array<{id: string, kind: 'info'|'success'|'error', text: string, ttl?: number}>} */ ([]))

/**
 * Push a toast. Auto-dismissed after ttl ms (0 = sticky).
 * @param {string} text
 * @param {'info'|'success'|'error'} [kind='info']
 * @param {number} [ttl=4000]
 */
export function pushToast(text, kind = 'info', ttl = 4000) {
  const id = 't' + Math.random().toString(36).slice(2, 10)
  toasts.value = [...toasts.value, { id, kind, text, ttl }]
  if (ttl > 0) setTimeout(() => dismissToast(id), ttl)
  return id
}

/** @param {string} id */
export function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}
