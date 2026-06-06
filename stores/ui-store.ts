// stores/ui-store.ts
// Legacy combined UI store. Each non-sidebar slice has been split out into
// `stores/ui/{toasts,modals,loading}.ts` so consumers can subscribe to
// only what they need. The Sidebar slice lives in `stores/ui/sidebar.ts`.
//
// This file remains as a thin re-export of the split slices so existing
// call-sites (e.g. `useUIStore((s) => s.toasts)`) keep working during the
// transition. New code should import directly from `@/stores/ui` instead.
//
// Migration plan:
//   - Add the new split-store imports in the page
//   - Remove the old `useUIStore` import
//   - Once the search hits zero references, delete this file.

import { useToastStore } from './ui/toasts'
import { useModalStore } from './ui/modals'
import { useLoadingStore } from './ui/loading'
import { useSidebarStore } from './ui/sidebar'

// Re-export each slice as a hook-shaped facade so the old
// `useUIStore((s) => s.toasts)` call pattern keeps compiling.
export const useUIStore = <T,>(selector: (s: {
  toasts: ReturnType<typeof useToastStore.getState>['toasts']
  addToast: ReturnType<typeof useToastStore.getState>['addToast']
  removeToast: ReturnType<typeof useToastStore.getState>['removeToast']
  activeModal: ReturnType<typeof useModalStore.getState>['activeModal']
  modalData: ReturnType<typeof useModalStore.getState>['modalData']
  openModal: ReturnType<typeof useModalStore.getState>['openModal']
  closeModal: ReturnType<typeof useModalStore.getState>['closeModal']
  globalLoading: ReturnType<typeof useLoadingStore.getState>['globalLoading']
  setGlobalLoading: ReturnType<typeof useLoadingStore.getState>['setGlobalLoading']
  sidebarCollapsed: ReturnType<typeof useSidebarStore.getState>['sidebarCollapsed']
  toggleSidebar: ReturnType<typeof useSidebarStore.getState>['toggleSidebar']
  setSidebarCollapsed: ReturnType<typeof useSidebarStore.getState>['setSidebarCollapsed']
}) => T): T =>
  selector({
    toasts: useToastStore((s) => s.toasts),
    addToast: useToastStore((s) => s.addToast),
    removeToast: useToastStore((s) => s.removeToast),
    activeModal: useModalStore((s) => s.activeModal),
    modalData: useModalStore((s) => s.modalData),
    openModal: useModalStore((s) => s.openModal),
    closeModal: useModalStore((s) => s.closeModal),
    globalLoading: useLoadingStore((s) => s.globalLoading),
    setGlobalLoading: useLoadingStore((s) => s.setGlobalLoading),
    sidebarCollapsed: useSidebarStore((s) => s.sidebarCollapsed),
    toggleSidebar: useSidebarStore((s) => s.toggleSidebar),
    setSidebarCollapsed: useSidebarStore((s) => s.setSidebarCollapsed),
  })
