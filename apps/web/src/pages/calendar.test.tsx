import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, renderApp } from '../test/render';

describe('CalendarPage', () => {
  beforeEach(() => {
    // Wednesday 14 Oct 2026, 12:00 Budapest. Only Date is faked so user-event timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it("shows this week's classes and free slots in Budapest time", async () => {
    renderApp('/calendar');

    expect(await screen.findByText(/Week of 12–18 Oct 2026/)).toBeInTheDocument();
    const monday = await screen.findByRole('region', { name: 'Monday 12 October' });
    expect(within(monday).getByLabelText('Algorithms and Data Structures I (lecture), 10:00–11:30, Déli Tömb 0-822')).toBeInTheDocument();
    // window 08:00–20:00 minus classes 10:00–11:30 and 14:00–15:30
    expect(within(monday).getByLabelText('Free 08:00–10:00')).toBeInTheDocument();
    expect(within(monday).getByLabelText('Free 11:30–14:00')).toBeInTheDocument();
    expect(within(monday).getByLabelText('Free 15:30–20:00')).toBeInTheDocument();
    // weekend has no window, so no free slots
    expect(within(screen.getByRole('region', { name: 'Sunday 18 October' })).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('sums the free time of the week', async () => {
    renderApp('/calendar');
    // 5 days × 12 h window − 11 h of classes = 49 h, minus Tuesday's 08:00–08:15 gap (< 30 min, dropped)
    expect(await screen.findByText(/48 h 45 min free for studying/)).toBeInTheDocument();
  });

  it('moves between weeks and keeps local times across the DST change', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/calendar');
    await screen.findByText(/Week of 12–18 Oct 2026/);

    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(await screen.findByText(/Week of 26 Oct – 1 Nov 2026/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('?week=2026-10-26');
    const monday = await screen.findByRole('region', { name: 'Monday 26 October' });
    expect(within(monday).getByLabelText(/Algorithms and Data Structures I \(lecture\), 10:00–11:30/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'This week' }));
    expect(await screen.findByText(/Week of 12–18 Oct 2026/)).toBeInTheDocument();
  });

  it('nudges users without classes to connect Neptun', async () => {
    db.users.get(DEMO_USER_ID)!.calendar.timetable = [];
    renderApp('/calendar');
    expect(await screen.findByText(/No classes this week/)).toBeInTheDocument();
  });

  it('is linked from the main navigation', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Calendar' }));
    expect(router.state.location.pathname).toBe('/calendar');
  });
});
