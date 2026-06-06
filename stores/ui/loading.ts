// stores/ui/loading.ts
// Global loading slice, split from the legacy god-store. Used for app-wide
// blocking spinners (e.g. during full-page transitions, theme reloads).
// Per-page / per-mutation loading state should still use the React Query
// `isPending` / `isLoading` flags.
import { create } from 'zustand'

export interface LoadingState {
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void
  withLoading: <T>(fn: () => Promise<T>) => Promise<T | undefined>
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  withLoading: async (fn) => {
    set({ globalLoading: true })
    try {
      return await fn()
    } finally {
      // Guard against unmount setting after a longer-running op.
      if (get().globalLoading) {
        set({ globalLoading: false })
      }
    }
  },
}))
