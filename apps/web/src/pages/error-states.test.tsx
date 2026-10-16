import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../mocks/server';
import { apiError, url } from '../mocks/utils';
import { loginAsDemo, renderApp } from '../test/render';

vi.mock('../components/map/LocationsMap', () => ({ default: () => <div>map</div> }));

/** The endpoint fails once with a 500, then works again. */
const failOnce = (method: 'get' | 'post', path: string) =>
  server.use(http[method](url(path), () => apiError(500, 'INTERNAL', 'Service temporarily unavailable'), { once: true }));

async function expectRetryWorks(what: string, afterRetry: () => Promise<unknown>) {
  const user = userEvent.setup();
  const alert = await screen.findByText(`Couldn't load ${what}.`);
  const box = alert.closest('[role="alert"]') as HTMLElement;
  expect(box).toHaveTextContent('Service temporarily unavailable');
  await user.click(within(box).getByRole('button', { name: 'Try again' }));
  await afterRetry();
  expect(screen.queryByText(`Couldn't load ${what}.`)).not.toBeInTheDocument();
}

describe('Error states (instead of misleading empty states)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('groups list', async () => {
    failOnce('get', '/groups');
    renderApp('/groups');
    expect(screen.queryByText('No groups yet')).not.toBeInTheDocument();
    await expectRetryWorks('your groups', () => screen.findByText('DB Thursday crew'));
  });

  it('calendar week', async () => {
    failOnce('get', '/me/schedule');
    renderApp('/calendar');
    await expectRetryWorks('your week', () => screen.findByRole('region', { name: 'Monday 12 October' }));
  });

  it('Neptun panel', async () => {
    failOnce('get', '/integrations/neptun');
    renderApp('/calendar');
    await expectRetryWorks('your Neptun connection', () => screen.findByRole('region', { name: 'Neptun calendar' }));
  });

  it('Discover subjects and the swipe deck', async () => {
    failOnce('get', '/me/subjects');
    const first = renderApp('/discover');
    expect(screen.queryByRole('link', { name: 'Add subjects' })).not.toBeInTheDocument();
    await expectRetryWorks('your subjects', () => screen.findByLabelText('Subject'));
    first.unmount();

    failOnce('get', '/matching/candidates');
    renderApp('/discover');
    expect(screen.queryByText("You've seen everyone for now.")).not.toBeInTheDocument();
    await expectRetryWorks('study partners', () => screen.findByRole('article'));
  });

  it('onboarding preferences (used to crash)', async () => {
    failOnce('get', '/me/preferences');
    renderApp('/onboarding?step=preferences');
    await expectRetryWorks('your preferences', () => screen.findByLabelText('Session length'));
  });

  it('group page sections', async () => {
    failOnce('get', '/groups/:groupId/suggested-slots');
    failOnce('get', '/groups/:groupId/sessions');
    renderApp('/groups/00000000-0000-4000-8005-000000000004');
    await expectRetryWorks('suggested times', () => within(screen.getByRole('region', { name: 'Suggested times' })).findAllByRole('listitem'));
    await expectRetryWorks('sessions', () => screen.findByText('Thu 22 Oct · 18:00–19:30'));
  });
});
