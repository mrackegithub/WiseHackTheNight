import { useSyncExternalStore } from 'react';

export type ToastKind = 'error' | 'success' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: ToastKind, message: string) {
  // Don't stack identical messages (e.g. several queries failing on the same outage).
  if (toasts.some((t) => t.kind === kind && t.message === message)) return;
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }];
  emit();
  setTimeout(() => toast.dismiss(id), AUTO_DISMISS_MS);
}

/** Global toast queue, usable outside React (e.g. from the QueryClient). */
export const toast = {
  error: (message: string) => push('error', message),
  success: (message: string) => push('success', message),
  info: (message: string) => push('info', message),
  dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
  clear() {
    toasts = [];
    emit();
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useToasts() {
  return useSyncExternalStore(subscribe, () => toasts);
}
