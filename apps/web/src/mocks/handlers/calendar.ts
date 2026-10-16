import { DateTime } from 'luxon';
import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { expandTimetable, freeSlots } from '../calendar';
import type { MockUser } from '../db';
import { sessionEvents } from '../sessions';
import { apiError, authed, url } from '../utils';

/** Parses the required from/to query (max 31 days, contract `From`/`To` parameters). */
function range(request: Request) {
  const p = new URL(request.url).searchParams;
  const from = DateTime.fromISO(p.get('from') ?? '');
  const to = DateTime.fromISO(p.get('to') ?? '');
  if (!from.isValid || !to.isValid || to <= from) return { error: apiError(422, 'VALIDATION_FAILED', 'from/to required', [{ path: 'from', issue: 'from and to must be ISO date-times, from < to' }]) };
  if (to.diff(from, 'days').days > 31) return { error: apiError(422, 'VALIDATION_FAILED', 'Range too long', [{ path: 'to', issue: 'max 31 days after from' }]) };
  return { from, to };
}

/** Classes from Neptun plus planned study sessions of the user's groups. */
const busyEvents = (user: MockUser, from: DateTime, to: DateTime) =>
  [...expandTimetable(user.calendar.timetable, from, to), ...sessionEvents(user.me.id, from, to)].sort((a, b) => a.start.localeCompare(b.start));

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const calendarHandlers = [
  http.get(
    url('/me/schedule'),
    authed((user, { request }) => {
      const r = range(request);
      if (r.error) return r.error;
      return HttpResponse.json<Schemas['CalendarEvent'][]>(busyEvents(user, r.from, r.to));
    }),
  ),

  http.get(
    url('/me/availability'),
    authed((user, { request }) => {
      const r = range(request);
      if (r.error) return r.error;
      return HttpResponse.json<Schemas['TimeSlot'][]>(freeSlots(user.calendar.windows, busyEvents(user, r.from, r.to), r.from, r.to));
    }),
  ),

  http.put(
    url('/me/availability'),
    authed(async (user, { request }) => {
      const windows = (await request.json()) as Schemas['WeeklyWindow'][];
      const bad = windows.findIndex(
        (w) => !Number.isInteger(w.weekday) || w.weekday < 1 || w.weekday > 7 || !HHMM.test(w.startTime) || !HHMM.test(w.endTime) || w.startTime >= w.endTime,
      );
      if (bad >= 0) return apiError(422, 'VALIDATION_FAILED', 'Invalid window', [{ path: `${bad}`, issue: 'weekday 1–7, HH:mm, start before end' }]);
      user.calendar.windows = windows;
      return HttpResponse.json<Schemas['WeeklyWindow'][]>(windows);
    }),
  ),
];
