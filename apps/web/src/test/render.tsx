import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../AppProviders';
import { tokenStore } from '../api/tokens';
import { createQueryClient } from '../lib/query-client';
import { db, DEMO_USER_ID, issueTokens, newMockUser, nextId, type MockUser } from '../mocks/db';
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

/** Creates a just-registered user (onboarding not done), applies `setup`, and logs them in. */
export function loginAsNewUser(setup: (user: MockUser) => void = () => {}) {
  const id = nextId();
  const user = newMockUser(
    {
      id,
      email: `new-${id.slice(-4)}@example.com`,
      displayName: 'New Student',
      bio: null,
      avatarUrl: null,
      university: null,
      faculty: null,
      location: null,
      interests: [],
      onboardingComplete: false,
      createdAt: '2026-10-01T08:00:00Z',
    },
    'password123',
  );
  setup(user);
  db.users.set(id, user);
  loginAsDemo(id);
  return user;
}
