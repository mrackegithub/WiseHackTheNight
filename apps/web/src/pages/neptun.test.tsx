import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, DEMO_USER_ID, type MockUser } from '../mocks/db';
import { api } from '../api/client';
import { importTimetable } from '../mocks/handlers/neptun';
import { loginAsDemo, loginAsNewUser, renderApp } from '../test/render';

const panel = () => screen.findByRole('region', { name: 'Neptun calendar' });
const onboarded = (u: MockUser) => {
  u.me.onboardingComplete = true;
};

describe('Neptun panel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows the sync status and syncs on demand', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/calendar');

    const p = await panel();
    expect(within(p).getByText('Synced')).toBeInTheDocument();
    expect(within(p).getByText(/Last synced .* · 112 classes/)).toBeInTheDocument();

    await user.click(within(p).getByRole('button', { name: 'Sync now' }));
    // the timetable has Discrete Mathematics I, which the demo user hasn't added yet
    expect(await screen.findByText('Calendar synced: 0 new, 0 removed, 1 subject added to your profile.')).toBeInTheDocument();
    expect(within(p).getByText(/Last synced just now/)).toBeInTheDocument();
  });

  it('connects with a Neptun link, imports classes and links subjects', async () => {
    const user = userEvent.setup();
    const me = loginAsNewUser(onboarded);
    renderApp('/calendar');
    const p = await panel();
    expect(within(p).getByText('Not connected')).toBeInTheDocument();
    expect(await screen.findByText(/No classes this week/)).toBeInTheDocument();

    await user.type(within(p).getByLabelText('Calendar link from Neptun'), 'not a link');
    await user.click(within(p).getByRole('button', { name: 'Connect' }));
    expect(within(p).getByText('Paste a link that starts with webcal:// or https://')).toBeInTheDocument();

    await user.clear(within(p).getByLabelText('Calendar link from Neptun'));
    await user.type(within(p).getByLabelText('Calendar link from Neptun'), 'webcal://neptun.example.edu/cal/abc.ics');
    await user.click(within(p).getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('Neptun connected. Your classes are in the calendar.')).toBeInTheDocument();
    expect(await within(p).findByText('Synced')).toBeInTheDocument();
    expect(await screen.findByLabelText(/Algorithms and Data Structures I \(lecture\), 10:00–11:30/)).toBeInTheDocument();
    expect(db.users.get(me.me.id)!.subjects.map((s) => s.subject.code).sort()).toEqual(['IP-18AA1E', 'IP-18AB1E', 'IP-18ANA1E', 'IP-18DM1E']);
  });

  it('shows the error when the feed cannot be fetched', async () => {
    const user = userEvent.setup();
    loginAsNewUser(onboarded);
    renderApp('/calendar');
    const p = await panel();

    await user.type(within(p).getByLabelText('Calendar link from Neptun'), 'https://unreachable.example/cal.ics');
    await user.click(within(p).getByRole('button', { name: 'Connect' }));

    expect(await within(p).findByText('Sync failed')).toBeInTheDocument();
    expect(within(p).getByRole('alert')).toHaveTextContent('Could not download the calendar (HTTP 404).');
    // a failing sync switches on the contract code
    await user.click(within(p).getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByText(/Couldn't reach Neptun/)).toBeInTheDocument();
  });

  it('uploads the chosen .ics file and reports the result', async () => {
    // File bytes can't cross fetch in this jsdom + Vitest + MSW setup (they arrive empty), so the
    // upload call itself is stubbed here; icsUploadForm is unit-tested in upload.test.ts.
    const sent: File[] = [];
    const me = loginAsNewUser(onboarded);
    const realPost = api.POST.bind(api);
    vi.spyOn(api, 'POST').mockImplementation(((path: string, init: { body: { file: unknown } }) => {
      if (path !== '/integrations/neptun/upload') return realPost(path as never, init as never);
      const file = init.body.file as File;
      sent.push(file);
      if (file.name !== 'timetable.ics') {
        return Promise.resolve({ error: { code: 'VALIDATION_FAILED', message: 'x', details: [{ path: 'file', issue: 'not iCalendar' }] }, response: new Response(null, { status: 422 }) });
      }
      return Promise.resolve({ data: importTimetable(db.users.get(me.me.id)!, false), response: new Response(null, { status: 200 }) });
    }) as never);

    const user = userEvent.setup();
    renderApp('/calendar');
    const p = await panel();
    const input = within(p).getByLabelText('Upload .ics file');

    await user.upload(input, new File(['hello'], 'notes.txt.ics', { type: 'text/calendar' }));
    expect(await screen.findByText('Please check: file')).toBeInTheDocument();

    await user.upload(input, new File(['BEGIN:VCALENDAR\nEND:VCALENDAR'], 'timetable.ics', { type: 'text/calendar' }));
    expect(await screen.findByText('Calendar synced: 112 new, 0 removed, 4 subjects added to your profile.')).toBeInTheDocument();
    expect(await within(p).findByText(/imported from a file/)).toBeInTheDocument();
    expect(sent.map((f) => f.name)).toEqual(['notes.txt.ics', 'timetable.ics']);
  });

  it('refuses files over 2 MB before uploading', async () => {
    const post = vi.spyOn(api, 'POST');
    loginAsNewUser(onboarded);
    const user = userEvent.setup();
    renderApp('/calendar');
    const p = await panel();

    await user.upload(within(p).getByLabelText('Upload .ics file'), new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.ics', { type: 'text/calendar' }));
    expect(await screen.findByText('That file is larger than 2 MB.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalledWith('/integrations/neptun/upload', expect.anything());
  });

  it('disconnects after confirmation and removes the imported classes', async () => {
    const user = userEvent.setup();
    loginAsDemo();
    renderApp('/calendar');
    const p = await panel();
    await screen.findByLabelText(/Algorithms and Data Structures I \(lecture\)/);

    await user.click(within(p).getByRole('button', { name: 'Disconnect' }));
    await user.click(within(p).getByRole('button', { name: 'Yes, disconnect' }));

    expect(await within(p).findByText('Not connected')).toBeInTheDocument();
    expect(await screen.findByText(/No classes this week/)).toBeInTheDocument();
    expect(db.users.get(DEMO_USER_ID)!.calendar.timetable).toEqual([]);
  });
});
