import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, onAuthFailure } from '../../api/client';
import { unwrap } from '../../api/errors';
import { tokenStore, type AuthTokens } from '../../api/tokens';
import { toast } from '../../lib/toast';
import { AuthContext, meQueryKey } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const tokens = useSyncExternalStore(tokenStore.subscribe, tokenStore.get);
  const isAuthenticated = tokens !== null;

  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: () => unwrap(api.GET('/me')),
    enabled: isAuthenticated,
  });

  const login = useCallback(
    (next: AuthTokens) => {
      queryClient.clear();
      tokenStore.set(next);
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
  }, [queryClient]);

  useEffect(
    () =>
      onAuthFailure(() => {
        queryClient.clear();
        toast.info('Your session has expired. Please log in again.');
      }),
    [queryClient],
  );

  const value = useMemo(
    () => ({ isAuthenticated, me: meQuery.data, isLoadingMe: meQuery.isPending && isAuthenticated, login, logout }),
    [isAuthenticated, meQuery.data, meQuery.isPending, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
