import { createContext, useContext } from 'react';
import type { Schemas } from '@sgm/contracts';
import type { AuthTokens } from '../../api/tokens';

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** The current user, once loaded. */
  me: Schemas['Me'] | undefined;
  isLoadingMe: boolean;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const meQueryKey = ['me'] as const;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
