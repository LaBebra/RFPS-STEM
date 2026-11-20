import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }));
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (t: string) => useToastStore.getState().push('success', t),
  error: (t: string) => useToastStore.getState().push('error', t),
  info: (t: string) => useToastStore.getState().push('info', t),
};
