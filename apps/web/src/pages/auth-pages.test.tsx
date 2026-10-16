import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { tokenStore } from '../api/tokens';
import { db, findUserByEmail } from '../mocks/db';
import { server } from '../mocks/server';
import { apiError, url } from '../mocks/utils';
import { loginAsDemo, renderApp } from '../test/render';

describe('LoginPage', () => {
  it('logs the demo user in and goes home', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'demo@sgm.local');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Demo Student!' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(tokenStore.get()).not.toBeNull();
  });

  it('returns to the protected page the user originally asked for', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/?tab=groups'); // RequireAuth redirects to /login, remembering this URL
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'demo@sgm.local');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await screen.findByRole('heading', { name: 'Welcome, Demo Student!' });
    expect(router.state.location.search).toBe('?tab=groups');
  });

  it('shows an inline error for a wrong password', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email'), 'demo@sgm.local');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
    expect(tokenStore.get()).toBeNull();
  });

  it('validates before calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('sends signed-in users away from /login', async () => {
    loginAsDemo();
    const { router } = renderApp('/login');
    await screen.findByRole('heading', { name: 'Welcome, Demo Student!' });
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('RegisterPage', () => {
  async function fillAndSubmit(name: string, email: string, password: string) {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), name);
    await user.type(screen.getByLabelText('Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('creates an account, signs the user in and starts onboarding', async () => {
    const { router } = renderApp('/register');
    await fillAndSubmit('Anna Kovács', 'anna@example.com', 'supersecret');

    expect(await screen.findByRole('heading', { name: 'Set up your profile' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
    expect(tokenStore.get()).not.toBeNull();
    expect(findUserByEmail('anna@example.com')?.me.onboardingComplete).toBe(false);
  });

  it('explains when the email is already registered (409)', async () => {
    renderApp('/register');
    await fillAndSubmit('Someone', 'demo@sgm.local', 'supersecret');
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
  });

  it('shows client-side validation errors without calling the API', async () => {
    const before = db.users.size;
    renderApp('/register');
    await fillAndSubmit('A', 'not-an-email', 'short');

    expect(screen.getByText('Name must be 2–50 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(db.users.size).toBe(before);
  });

  it('puts server VALIDATION_FAILED details on the matching fields', async () => {
    server.use(
      http.post(url('/auth/register'), () =>
        apiError(422, 'VALIDATION_FAILED', 'invalid', [{ path: 'body.email', issue: 'This domain is not allowed' }]),
      ),
    );
    renderApp('/register');
    await fillAndSubmit('Anna', 'anna@blocked.test', 'supersecret');

    const email = screen.getByLabelText('Email');
    expect(await screen.findByText('This domain is not allowed')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });
});
