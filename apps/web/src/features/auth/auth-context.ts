import { createContext, useContext } from 'react';
import { queryOptions } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import type { AuthTokens } from '../../api/tokens';

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** The current user, once loaded. */
  me: Schemas['Me'] | undefined;
  isLoadingMe: boolean;
  /** Set when GET /me failed for a reason other than an expired session. */
  meError: Error | null;
  retryMe: () => void;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const meQueryKey = ['me'] as const;

/** GET /me. AuthProvider owns fetching; other components may read the cache with `{ ...meQuery, enabled: false }`. */
export const meQuery = queryOptions({ queryKey: meQueryKey, queryFn: () => unwrap(api.GET('/me')), meta: { silent: true } });

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
