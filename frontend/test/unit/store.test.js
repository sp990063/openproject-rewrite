// frontend/test/unit/store.test.js
import { describe, it, expect, vi } from 'vitest'
import { signal, effect, computed, batch, pushToast, dismissToast, toasts } from '../../store.js'

describe('signal', () => {
  it('reads and writes value', () => {
    const s = signal(0)
    expect(s.value).toBe(0)
    s.value = 42
    expect(s.value).toBe(42)
  })

  it('does not notify on equal value (Object.is)', () => {
    const s = signal(0)
    const fn = vi.fn()
    s.subscribe(fn)
    s.value = 0  // same
    expect(fn).not.toHaveBeenCalled()
    s.value = 1
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('subscribe returns disposer', () => {
    const s = signal(0)
    const fn = vi.fn()
    const dispose = s.subscribe(fn)
    s.value = 1
    expect(fn).toHaveBeenCalledTimes(1)
    dispose()
    s.value = 2
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('effect', () => {
  it('re-runs when signal changes', () => {
    const s = signal(0)
    const fn = vi.fn(() => s.value)
    const dispose = effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)  // initial
    s.value = 1
    expect(fn).toHaveBeenCalledTimes(2)
    s.value = 2
    expect(fn).toHaveBeenCalledTimes(3)
    dispose()
    s.value = 3
    expect(fn).toHaveBeenCalledTimes(3)  // disposed
  })

  it('tracks multiple signals', () => {
    const a = signal(0)
    const b = signal(0)
    const fn = vi.fn(() => { a.value; b.value })
    effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    a.value = 1
    expect(fn).toHaveBeenCalledTimes(2)
    b.value = 1
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('dispose stops listening', () => {
    const s = signal(0)
    const fn = vi.fn(() => s.value)
    const dispose = effect(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    dispose()
    s.value = 1
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('batch', () => {
  it('defers subscriber notification', () => {
    const s = signal(0)
    const fn = vi.fn()
    s.subscribe(fn)
    batch(() => {
      s.value = 1
      s.value = 2
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('toasts', () => {
  beforeEach(() => { toasts.value = [] })
  it('push adds toast to signal', () => {
    pushToast('hello', 'info', 0)  // 0 = sticky, no auto-dismiss
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].text).toBe('hello')
  })
  it('dismiss removes by id', () => {
    const id = pushToast('hi', 'info', 0)
    expect(toasts.value).toHaveLength(1)
    dismissToast(id)
    expect(toasts.value).toHaveLength(0)
  })
})
