import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../AppProviders';
import { tokenStore } from '../api/tokens';
import { createQueryClient } from '../lib/query-client';
import { DEMO_USER_ID, issueTokens } from '../mocks/db';
import { routes } from '../routes';

/** Renders the whole app (real routes, providers and MSW mocks) at `path`. */
export function renderApp(path = '/') {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, queryClient };
}

/** Logs the seeded demo user in (valid mock tokens in the token store). */
export function loginAsDemo(userId = DEMO_USER_ID) {
  const tokens = issueTokens(userId);
  tokenStore.set(tokens);
  return tokens;
}
