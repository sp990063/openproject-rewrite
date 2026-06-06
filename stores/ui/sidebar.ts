'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Sidebar store — split out of the god-store (stores/ui-store.ts) for the
 * v2 frontend revamp. Only the `sidebarCollapsed` slice is persisted; the
 * `toggleSidebar` / `setSidebarCollapsed` actions are transient.
 *
 * Consumers that still use the old `useUIStore` from stores/ui-store.ts
 * are unaffected — both stores coexist. New code should import
 * `useSidebarStore` from here.
 */
export interface SidebarState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'op-rewrite-sidebar',
      storage: createJSONStorage(() => localStorage),
      // Only persist the collapsed flag; actions live in the store closure.
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
)
