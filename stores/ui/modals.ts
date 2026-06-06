// stores/ui/modals.ts
// Modal slice, split from the legacy god-store. Tracks the currently
// open modal id + optional payload, so any page can `openModal('foo', {...})`
// and the modal root can render accordingly.
import { create } from 'zustand'

export interface ModalState {
  activeModal: string | null
  modalData: Record<string, unknown> | null
  openModal: (modalId: string, data?: Record<string, unknown>) => void
  closeModal: () => void
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  modalData: null,
  openModal: (modalId, data) =>
    set({ activeModal: modalId, modalData: data ?? null }),
  closeModal: () => set({ activeModal: null, modalData: null }),
}))
