import type { Schemas } from '@sgm/contracts';

export type AuthTokens = Schemas['AuthTokens'];

const STORAGE_KEY = 'sgm.auth';

function read(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

function write(tokens: AuthTokens | null) {
  try {
    if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): tokens still live in memory for this tab.
  }
}

let current: AuthTokens | null = read();
const listeners = new Set<() => void>();

/** Access + refresh tokens, persisted in localStorage. Subscribable for useSyncExternalStore. */
export const tokenStore = {
  get: () => current,
  set(tokens: AuthTokens | null) {
    current = tokens;
    write(tokens);
    listeners.forEach((l) => l());
  },
  clear() {
    tokenStore.set(null);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Re-reads storage; used by tests after clearing localStorage. */
  reload() {
    current = read();
    listeners.forEach((l) => l());
  },
};
