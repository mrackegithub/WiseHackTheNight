import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID } from '../mocks/db';
import { loginAsDemo, renderApp } from '../test/render';

const editor = () => screen.findByRole('region', { name: 'Your study hours' });
const savedWindows = () => db.users.get(DEMO_USER_ID)!.calendar.windows;

describe('Study hours editor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z')); // Wed 14 Oct 2026
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('starts from the default Mon–Fri 08:00–20:00', async () => {
    renderApp('/calendar');
    const e = await editor();
    expect(within(e).getByLabelText('Monday range 1 start')).toHaveValue('08:00');
    expect(within(e).getByLabelText('Friday range 1 end')).toHaveValue('20:00');
    expect(within(within(e).getByRole('group', { name: 'Saturday hours' })).getByText('Not available')).toBeInTheDocument();
    expect(within(e).getByRole('button', { name: 'Save hours' })).toBeDisabled();
  });

  it('saves changed hours and the free slots follow', async () => {
    const user = userEvent.setup();
    renderApp('/calendar');
    const e = await editor();

    fireEvent.change(within(e).getByLabelText('Monday range 1 end'), { target: { value: '12:00' } });
    await user.click(within(e).getByRole('button', { name: 'Save hours' }));

    expect(await screen.findByText('Study hours saved. Your free slots are updated.')).toBeInTheDocument();
    expect(savedWindows().find((w) => w.weekday === 1)).toEqual({ weekday: 1, startTime: '08:00', endTime: '12:00' });
    const monday = screen.getByRole('region', { name: 'Monday 12 October' });
    expect(await within(monday).findByLabelText('Free 11:30–12:00')).toBeInTheDocument();
    expect(within(monday).queryByLabelText('Free 15:30–20:00')).not.toBeInTheDocument();
  });

  it('adds weekend hours', async () => {
    const user = userEvent.setup();
    renderApp('/calendar');
    const e = await editor();

    await user.click(within(e).getByRole('button', { name: 'Add hours on Saturday' }));
    await user.click(within(e).getByRole('button', { name: 'Save hours' }));

    await screen.findByText('Study hours saved. Your free slots are updated.');
    const saturday = screen.getByRole('region', { name: 'Saturday 17 October' });
    expect(await within(saturday).findByLabelText('Free 09:00–17:00')).toBeInTheDocument();
  });

  it('blocks saving invalid or overlapping ranges', async () => {
    const user = userEvent.setup();
    renderApp('/calendar');
    const e = await editor();

    await user.click(within(e).getByRole('button', { name: 'Add hours on Tuesday' })); // 09:00–17:00 overlaps 08:00–20:00
    fireEvent.change(within(e).getByLabelText('Wednesday range 1 end'), { target: { value: '07:00' } });
    await user.click(within(e).getByRole('button', { name: 'Save hours' }));

    const tuesday = within(e).getByRole('group', { name: 'Tuesday hours' });
    expect(within(tuesday).getByRole('alert')).toHaveTextContent('must not overlap');
    expect(within(within(e).getByRole('group', { name: 'Wednesday hours' })).getByRole('alert')).toHaveTextContent('end after it starts');
    expect(savedWindows()).toHaveLength(5); // nothing sent
  });

  it('copies Monday to the other weekdays and can reset', async () => {
    const user = userEvent.setup();
    renderApp('/calendar');
    const e = await editor();

    fireEvent.change(within(e).getByLabelText('Monday range 1 start'), { target: { value: '10:00' } });
    await user.click(within(e).getByRole('button', { name: 'Copy Monday to Tue–Fri' }));
    expect(within(e).getByLabelText('Thursday range 1 start')).toHaveValue('10:00');

    await user.click(within(e).getByRole('button', { name: 'Reset' }));
    expect(within(e).getByLabelText('Thursday range 1 start')).toHaveValue('08:00');
  });

  it('shows the last saved hours after a reload (stopgap until the contract can return them)', async () => {
    const user = userEvent.setup();
    const first = renderApp('/calendar');
    let e = await editor();
    await user.click(within(e).getByRole('button', { name: 'Remove Friday range 1' }));
    await user.click(within(e).getByRole('button', { name: 'Save hours' }));
    await screen.findByText('Study hours saved. Your free slots are updated.');
    first.unmount();

    renderApp('/calendar');
    e = await editor();
    expect(within(within(e).getByRole('group', { name: 'Friday hours' })).getByText('Not available')).toBeInTheDocument();
  });
});
