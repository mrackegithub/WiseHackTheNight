import { screen } from '@testing-library/react';
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

  it('shows a toast based on the error code when a request fails', async () => {
    loginAsDemo();
    server.use(http.get(url('/me'), () => apiError(404, 'NOT_FOUND', 'no such user')));
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't find what you were looking for.");
  });

  it('renders a not-found page for unknown routes', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
