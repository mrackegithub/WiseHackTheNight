import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
import { messageForError } from './error-messages';
import { toast } from './toast';

declare module '@tanstack/react-query' {
  interface Register {
    /** `meta: { silent: true }` = the component shows the error itself, so skip the global toast. */
    queryMeta: { silent?: boolean };
    mutationMeta: { silent?: boolean };
  }
}

const isClientError = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500;

function notify(error: unknown, silent?: boolean) {
  // 401s are handled by the auth flow (refresh, or log out with its own message).
  if (silent || (error instanceof ApiError && error.status === 401)) return;
  toast.error(messageForError(error));
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => notify(error, query.meta?.silent) }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => notify(error, mutation.meta?.silent),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx won't fix itself on retry; network / 5xx errors get two more tries.
        retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      },
    },
  });
}
