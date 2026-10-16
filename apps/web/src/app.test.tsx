import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { tokenStore } from './api/tokens';
import { db } from './mocks/db';
import { server } from './mocks/server';
import { apiError, url } from './mocks/utils';
import { loginAsDemo, renderApp } from './test/render';

describe('app shell', () => {
  it('sends anonymous visitors to the login page', async () => {
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the signed-in user from GET /me', async () => {
    loginAsDemo();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Demo Student!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('refreshes an expired access token transparently', async () => {
    const tokens = loginAsDemo();
    db.accessTokens.delete(tokens.accessToken); // server-side expiry
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Welcome, Demo Student!' })).toBeInTheDocument();
    expect(tokenStore.get()?.accessToken).not.toBe(tokens.accessToken);
  });

  it('logs out and says why when the session cannot be refreshed', async () => {
    const tokens = loginAsDemo();
    db.accessTokens.delete(tokens.accessToken);
    db.refreshTokens.delete(tokens.refreshToken);
    const { router } = renderApp('/');
    expect(await screen.findByText(/session has expired/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(tokenStore.get()).toBeNull();
  });

  it('shows a toast based on the error code when an action fails', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    server.use(http.post(url('/matching/swipes'), () => apiError(409, 'GROUP_FULL', 'internal message')));
    renderApp('/discover');
    await screen.findByRole('article');

    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This group is already full.');
  });

  it('shows a retryable error page when the profile cannot be loaded', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    server.use(http.get(url('/me'), () => apiError(500, 'INTERNAL', 'Database unavailable'), { once: true }));
    renderApp('/');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load your profile.");
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Demo Student!' })).toBeInTheDocument();
  });

  it('renders a not-found page for unknown routes', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
