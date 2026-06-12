// lib/mutationError.ts
//
// Shared onError helper for TanStack Query mutations.
// Addresses HS-11 (zero onError handlers → silent failures).
//
// Usage:
//   import { onMutationError } from '@/lib/mutationError'
//
//   useMutation({
//     mutationFn: ...,
//     onError: (err, vars, ctx) => onMutationError(err, 'Failed to create thread'),
//   })
//
// Behaviour:
//   - Pushes a toast via the shared `pushToast` API (ui-store).
//   - console.error's the full error (so devs see stack in dev tools).
//   - No-op when called server-side (Node has no `useUIStore`).
//
// We don't import ui-store directly to avoid a circular dep: hooks/*
// may be consumed by both Next.js and the vanilla frontend. The
// `pushToast` export exists in both worlds under different paths,
// so we lazy-import based on the runtime.
import type { QueryClient } from '@tanstack/react-query'

/**
 * Standard onError handler for mutations.
 * @param {unknown} err — the error thrown by mutationFn
 * @param {string} [fallback] — fallback message when err.message is empty
 */
export function onMutationError(err: unknown, fallback = 'Something went wrong'): void {
  const message =
    err instanceof Error && err.message ? err.message :
    typeof err === 'string' ? err :
    fallback
  if (typeof window !== 'undefined') {
    // Lazy import: avoid breaking the vanilla frontend build where the
    // Next.js ui-store is not available.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { pushToast } = require('@/stores/ui/toasts') as { pushToast: (m: string, k: 'error') => void }
      pushToast(message, 'error')
    } catch {
      // ui-store not available (vanilla frontend or test) — fall through to console.
      console.error('[mutationError]', err)
    }
  } else {
    console.error('[mutationError]', err)
  }
}

/**
 * Wrap a mutation object with onError wiring in one call.
 * @template T
 * @param {object} cfg — useMutation config
 * @param {string} [fallback] — fallback toast message
 * @returns same config with onError added (preserves any existing onError)
 */
export function withMutationError<T extends { onError?: (err: unknown, vars: unknown, ctx: unknown) => void }>(
  cfg: T,
  fallback?: string
): T {
  const existing = cfg.onError
  return {
    ...cfg,
    onError: (err, vars, ctx) => {
      onMutationError(err, fallback)
      if (existing) existing(err, vars, ctx)
    },
  }
}

/**
 * Type guard: check whether a TanStack Query error is a server-side
 * error envelope (`{ error: { code, message } }`) thrown via `unwrap()`.
 * @param {unknown} err
 */
export function isServerError(err: unknown): err is Error & { status?: number; code?: string } {
  return err instanceof Error && typeof (err as { status?: number }).status === 'number'
}

/**
 * Invalidate a list of query keys in parallel. Returns a Promise.all
 * for use inside onSuccess.
 * @param {QueryClient} queryClient
 * @param {ReadonlyArray<readonly unknown[]>} keys
 */
export function invalidateAll(
  queryClient: QueryClient,
  keys: ReadonlyArray<readonly unknown[]>
): Promise<void> {
  return Promise.all(
    keys.map((k) => queryClient.invalidateQueries({ queryKey: [...k] }))
  ).then(() => undefined)
}
