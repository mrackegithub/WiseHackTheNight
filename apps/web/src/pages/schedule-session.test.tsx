import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZONE } from '../lib/time';
import { db, DEMO_USER_ID } from '../mocks/db';
import { server } from '../mocks/server';
import { sessionEvents } from '../mocks/sessions';
import { apiError, url } from '../mocks/utils';
import { loginAsDemo, renderApp } from '../test/render';

vi.mock('../components/map/LocationsMap', () => ({ default: () => <div>map</div> }));

const DB_CREW = '00000000-0000-4000-8005-000000000004';
const crewSessions = () => db.groups.get(DB_CREW)!.sessions;

async function openScheduler(user: ReturnType<typeof userEvent.setup>) {
  const slots = await screen.findByRole('region', { name: 'Suggested times' });
  const [first] = await within(slots).findAllByRole('button', { name: /^Schedule / });
  await user.click(first);
  return screen.findByRole('dialog', { name: 'Schedule a session' });
}

describe('Schedule a session', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    loginAsDemo();
  });
  afterEach(() => vi.useRealTimers());

  it('schedules at a suggested place and shows it in sessions and in members’ calendars', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const before = crewSessions().length;
    const dialog = await openScheduler(user);

    expect(within(dialog).getByLabelText('Length')).toHaveValue('90'); // the demo user's preferred length
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    const places = within(dialog).getAllByRole('radio');
    await user.click(places[0]);
    const placeName = places[0].closest('label')!.querySelector('.font-medium')!.textContent!;
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByText(placeName)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(await screen.findByText(/^Session scheduled for /)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(crewSessions()).toHaveLength(before + 1);
    const created = crewSessions().at(-1)!;
    expect(created).toMatchObject({ status: 'PLANNED', location: { name: placeName } });
    expect((Date.parse(created.end) - Date.parse(created.start)) / 60_000).toBe(90);

    const sessions = screen.getByRole('region', { name: 'Sessions' });
    expect(await within(sessions).findByText(placeName)).toBeInTheDocument();
    // mirrored into the member's calendar as a STUDY_SESSION block
    const week = [DateTime.fromISO(created.start, { zone: ZONE }).startOf('day'), DateTime.fromISO(created.end, { zone: ZONE }).endOf('day')] as const;
    expect(sessionEvents(DEMO_USER_ID, ...week).map((e) => e.id)).toContain(created.id);
  });

  it('needs a link for online sessions', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await openScheduler(user);

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('radio', { name: /Online/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Paste the meeting link');

    await user.type(within(dialog).getByLabelText('Meeting link'), 'https://meet.example.com/db');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    await screen.findByText(/^Session scheduled for /);
    expect(crewSessions().at(-1)).toMatchObject({ onlineUrl: 'https://meet.example.com/db', location: null });
  });

  it('can leave the place open and adjust the time', async () => {
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await openScheduler(user);

    const start = within(dialog).getByLabelText('Start');
    const options = within(start).getAllByRole('option');
    await user.selectOptions(start, options[1]);
    await user.selectOptions(within(dialog).getByLabelText('Length'), '60');
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' })); // "Decide later" is the default
    expect(within(dialog).getByText('Not decided yet')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    await screen.findByText(/^Session scheduled for /);
    const created = crewSessions().at(-1)!;
    expect(created.start).toBe((options[1] as HTMLOptionElement).value);
    expect((Date.parse(created.end) - Date.parse(created.start)) / 60_000).toBe(60);
  });

  it('explains a 409 (a member is busy) and keeps the dialog open', async () => {
    server.use(http.post(url('/groups/:groupId/sessions'), () => apiError(409, 'CONFLICT', 'Levente is busy')));
    const user = userEvent.setup();
    renderApp(`/groups/${DB_CREW}`);
    const dialog = await openScheduler(user);

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule session' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Someone in the group is busy at that time.');
  });

  it('closes on Cancel and is only offered to members', async () => {
    const user = userEvent.setup();
    const first = renderApp(`/groups/${DB_CREW}`);
    const dialog = await openScheduler(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    first.unmount();

    renderApp('/groups/00000000-0000-4000-8005-000000000001'); // open group, not a member
    const slots = await screen.findByRole('region', { name: 'Suggested times' });
    await within(slots).findAllByRole('listitem');
    expect(within(slots).queryByRole('button', { name: /^Schedule / })).not.toBeInTheDocument();
  });
});
