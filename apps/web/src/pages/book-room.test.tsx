import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { db } from '../mocks/db';
import { server } from '../mocks/server';
import { apiError, url } from '../mocks/utils';
import { loginAsDemo, renderApp } from '../test/render';

vi.mock('../components/map/LocationsMap', () => ({ default: () => <div>map</div> }));

const DB_CREW = '00000000-0000-4000-8005-000000000004';
const crewSessions = () => db.groups.get(DB_CREW)!.sessions;
const bookings = () => [...db.bookings.values()];

type User = ReturnType<typeof userEvent.setup>;

/** Opens the scheduler on the first suggested time and picks a bookable / non-bookable place. */
async function toRoomStep(user: User, bookable = true) {
  const slots = await screen.findByRole('region', { name: 'Suggested times' });
  await user.click((await within(slots).findAllByRole('button', { name: /^Schedule / }))[0]);
  const dialog = await screen.findByRole('dialog', { name: 'Schedule a session' });
  await user.click(within(dialog).getByRole('button', { name: 'Next' }));
  const placeLabel = (await within(dialog).findAllByRole('radio'))
    .map((r) => r.closest('label')!)
    .find((l) => !!within(l).queryByText('Bookable') === bookable && within(l).queryByText(/at most/))!;
  await user.click(within(placeLabel).getByRole('radio'));
  await user.click(within(dialog).getByRole('button', { name: 'Next' }));
  return dialog;
}

describe('Book a room while scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('books a free room and links it to the session', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await toRoomStep(user);

    expect(within(dialog).getByRole('list', { name: 'Steps' })).toHaveTextContent('3. Room');
    await user.click(await within(dialog).findByRole('radio', { name: /Group room 2/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByText('Group room 2 (will be booked)')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(await screen.findByText(/^Session scheduled for .* in Group room 2\.$/)).toBeInTheDocument();
    const [booking] = bookings();
    expect(booking).toMatchObject({ status: 'CONFIRMED', groupId: DB_CREW, room: { name: 'Group room 2' } });
    expect(crewSessions().at(-1)).toMatchObject({ bookingId: booking.id, start: booking.start, end: booking.end });
    expect(await within(screen.getByRole('region', { name: 'Sessions' })).findByText(/Group room 2 booked/)).toBeInTheDocument();
  });

  it('recovers when the room was just taken (SLOT_TAKEN)', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await toRoomStep(user);

    await user.click(await within(dialog).findByRole('radio', { name: /Silent room 3/ })); // mock: always taken
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That room was just booked by someone else.');
    expect(within(dialog).getByRole('radio', { name: "Don't book a room" })).toBeChecked(); // back on the room step
    expect(crewSessions().filter((s) => s.bookingId)).toHaveLength(0);

    await user.click(within(dialog).getByRole('radio', { name: /Group room 1/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));
    expect(await screen.findByText(/in Group room 1\.$/)).toBeInTheDocument();
  });

  it('cancels the booking again when the session cannot be created', async () => {
    server.use(http.post(url('/groups/:groupId/sessions'), () => apiError(409, 'CONFLICT', 'busy')));
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await toRoomStep(user);

    await user.click(await within(dialog).findByRole('radio', { name: /Group room 1/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Someone in the group is busy');
    expect(bookings().map((b) => b.status)).toEqual(['CANCELLED']);
  });

  it('skips the room step for places that cannot be booked', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await toRoomStep(user, false);

    expect(within(dialog).getByRole('list', { name: 'Steps' })).not.toHaveTextContent('Room');
    expect(within(dialog).getByRole('button', { name: 'Schedule session' })).toBeInTheDocument();
  });

  it('can meet at a bookable place without booking', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await toRoomStep(user);

    await within(dialog).findAllByRole('radio');
    await user.click(within(dialog).getByRole('button', { name: 'Next' })); // "Don't book a room" is preselected
    expect(within(dialog).getByText('No booking')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    await screen.findByText(/^Session scheduled for /);
    expect(bookings()).toHaveLength(0);
    expect(crewSessions().at(-1)!.bookingId).toBeNull();
  });
});

describe('GET /rooms (mock)', () => {
  beforeEach(() => loginAsDemo());

  it('hides rooms that are booked for an overlapping time and those too small', async () => {
    const start = '2026-10-20T08:00:00Z';
    const end = '2026-10-20T09:30:00Z';
    const locationId = '00000000-0000-4000-8007-000000000001';
    const before = (await api.GET('/rooms', { params: { query: { locationId, start, end, capacity: 2 } } })).data!;
    expect(before.map((r) => r.name)).toEqual(['Group room 1', 'Group room 2', 'Silent room 3 (popular)']);

    await api.POST('/bookings', { body: { roomId: before[0].id, groupId: DB_CREW, start: '2026-10-20T09:00:00Z', end: '2026-10-20T10:00:00Z' } });
    const after = (await api.GET('/rooms', { params: { query: { locationId, start, end, capacity: 5 } } })).data!;
    expect(after.map((r) => r.name)).toEqual(['Group room 2', 'Silent room 3 (popular)']);
  });
});
