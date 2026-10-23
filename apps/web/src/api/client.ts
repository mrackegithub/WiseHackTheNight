import createClient from 'openapi-fetch';
import type { paths } from '@sgm/contracts';
import { config } from '../lib/config';
import { tokenStore, type AuthTokens } from './tokens';

type TokenStore = Pick<typeof tokenStore, 'get' | 'set' | 'clear'>;

interface AuthFetchOptions {
  baseUrl: string;
  tokens: TokenStore;
  onAuthFailure?: () => void;
  /** Resolved per call so test interceptors (MSW) that patch globalThis.fetch still apply. */
  fetch?: (input: Request) => Promise<Response>;
}

const isAuthEndpoint = (url: string) => {
  const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
  return pathname.includes('/auth/');
};

/**
 * fetch wrapper that adds the Bearer token and, on a 401, refreshes the access token once
 * (shared between concurrent requests) and retries. If the refresh fails the session is cleared.
 */
export function createAuthFetch({ baseUrl, tokens, onAuthFailure, fetch: baseFetch }: AuthFetchOptions) {
  const doFetch = (input: Request) => (baseFetch ? baseFetch(input) : globalThis.fetch(input));
  let refreshing: Promise<string | null> | null = null;

  const refresh = () =>
    (refreshing ??= (async () => {
      const refreshToken = tokens.get()?.refreshToken;
      if (!refreshToken) return null;
      try {
        const res = await doFetch(
          new Request(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          }),
        );
        if (!res.ok) return null;
        const next = (await res.json()) as AuthTokens;
        tokens.set(next);
        return next.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshing = null;
    }));

  return async (request: Request): Promise<Response> => {
    const retry = request.clone();
    const accessToken = tokens.get()?.accessToken;
    if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await doFetch(request);
    if (response.status !== 401 || isAuthEndpoint(request.url) || !tokens.get()?.refreshToken) return response;

    const newToken = await refresh();
    if (!newToken) {
      tokens.clear();
      onAuthFailure?.();
      return response;
    }
    retry.headers.set('Authorization', `Bearer ${newToken}`);
    return doFetch(retry);
  };
}

const authFailureListeners = new Set<() => void>();

/** Called when the session can't be refreshed (the user must log in again). */
export function onAuthFailure(listener: () => void) {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

export const authFetch = createAuthFetch({
  baseUrl: config.apiUrl,
  tokens: tokenStore,
  onAuthFailure: () => authFailureListeners.forEach((l) => l()),
});

/** Generic fetch helper with auth headers and error handling. */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = config.apiUrl;
  const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await authFetch(new Request(url, init));
  if (!res.ok) {
    throw new Error(`API fetch failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Typed client for the whole contract: `api.GET('/me')`, `api.POST('/auth/login', { body })`, ... */
export const api = createClient<paths>({
  baseUrl: config.apiUrl,
  fetch: authFetch,
});
