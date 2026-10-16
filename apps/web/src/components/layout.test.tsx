import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loginAsDemo, renderApp } from '../test/render';

describe('Layout and accessibility', () => {
  it('has one "Main" navigation (bottom bar on phones, header on desktop) with the current page marked', async () => {
    loginAsDemo();
    renderApp('/groups');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Home', 'Discover', 'Groups', 'Calendar']);
    expect(within(nav).getByRole('link', { name: 'Groups' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('offers a skip link to a focusable main region', async () => {
    renderApp('/login');
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('sets the page title per route', async () => {
    loginAsDemo();
    const { router } = renderApp('/calendar');
    await screen.findByRole('heading', { name: 'Calendar' });
    expect(document.title).toBe('Calendar · Study Group Matcher');

    await router.navigate('/groups/00000000-0000-4000-8005-000000000004');
    await screen.findByRole('heading', { name: 'DB Thursday crew' });
    expect(document.title).toBe('DB Thursday crew · Study Group Matcher');
  });

  it('moves focus to the main content after navigating', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Welcome, Demo Student!' });

    await user.click(screen.getByRole('link', { name: 'Discover' }));
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('shows no navigation to signed-out visitors', async () => {
    renderApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
