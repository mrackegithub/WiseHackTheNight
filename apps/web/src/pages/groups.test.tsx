import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, loginAsNewUser, renderApp } from '../test/render';

const DB_CREW = '00000000-0000-4000-8005-000000000004';
const ALGO_OWLS = '00000000-0000-4000-8005-000000000001';

describe('Groups', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z')); // Wed 14 Oct 2026, 12:00 Budapest
  });
  afterEach(() => vi.useRealTimers());

  it('lists my groups with the next session, soonest first', async () => {
    loginAsDemo();
    db.groups.get(ALGO_OWLS)!.members.push({ userId: DEMO_USER_ID, role: 'CAN_EXPLAIN', isOwner: false, joinedAt: '2026-10-10T10:00:00Z' });
    renderApp('/groups');

    const links = await screen.findAllByRole('link', { name: /members/ });
    expect(links.map((l) => l.querySelector('span span')?.textContent)).toEqual(['Algo Night Owls', 'DB Thursday crew']);
    expect(links[0]).toHaveTextContent('Next: Tue 20 Oct, 19:00');
    expect(links[1]).toHaveTextContent('2/4 members');
    expect(links[1]).toHaveTextContent('Next: Thu 22 Oct, 18:00');
  });

  it('shows an empty state for users without groups', async () => {
    loginAsNewUser((u) => (u.me.onboardingComplete = true));
    renderApp('/groups');
    expect(await screen.findByText('No groups yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Discover' })).toHaveAttribute('href', '/discover');
  });

  it('shows suggested times with who is free, and the sessions', async () => {
    loginAsDemo();
    renderApp(`/groups/${DB_CREW}`);

    const slots = await screen.findByRole('region', { name: 'Suggested times' });
    const items = await within(slots).findAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    for (const item of items) expect(item).toHaveTextContent(/Everyone is free|1 of 2 free · not Levente Papp/);

    const sessions = await screen.findByRole('region', { name: 'Sessions' });
    const rows = await within(sessions).findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Thu 22 Oct · 18:00–19:30');
    expect(rows[0]).toHaveTextContent('Place not set');
    expect(rows[0]).toHaveTextContent('Planned');
    expect(rows[1]).toHaveTextContent('Thu 8 Oct · 18:00–19:30');
    expect(rows[1]).toHaveTextContent('Done');
  });

  it('links online sessions', async () => {
    loginAsDemo();
    renderApp(`/groups/${ALGO_OWLS}`); // open group, visible to non-members
    const sessions = await screen.findByRole('region', { name: 'Sessions' });
    expect(await within(sessions).findByRole('link', { name: 'Online meeting' })).toHaveAttribute('href', 'https://meet.example.com/algo-night-owls');
    expect(screen.queryByRole('button', { name: 'Leave group' })).not.toBeInTheDocument(); // not a member
    expect(screen.getByRole('button', { name: 'Join group' })).toBeInTheDocument();
  });

  it('allows joining an open group directly from the group page', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp(`/groups/${ALGO_OWLS}`);

    const joinBtn = await screen.findByRole('button', { name: 'Join group' });
    expect(joinBtn).toBeInTheDocument();
    await user.click(joinBtn);

    expect(await screen.findByText('You joined Algo Night Owls!')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Invite people' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave group' })).toBeInTheDocument();
  });

  it('leaves a group after confirmation', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    const { router } = renderApp(`/groups/${DB_CREW}`);

    await user.click(await screen.findByRole('button', { name: 'Leave group' }));
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }));

    expect(await screen.findByText('You left DB Thursday crew.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/groups');
    expect(await screen.findByText('No groups yet')).toBeInTheDocument();
    expect(db.groups.get(DB_CREW)!.members.map((m) => m.isOwner)).toEqual([true]); // ownership passed on
  });

  it('is linked from the main navigation', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    const { router } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Groups' }));
    expect(router.state.location.pathname).toBe('/groups');
  });
});
