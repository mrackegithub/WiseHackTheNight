import { DateTime } from 'luxon';
import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { expandTimetable, freeSlots } from '../calendar';
import { toApiTime, ZONE } from '../../lib/time';
import { db, nextId, type MockUser } from '../db';
import { isMember } from '../groups';
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

const overlapsRange = (e: { start: string; end: string }, from: DateTime, to: DateTime) =>
  Date.parse(e.start) < to.toMillis() && Date.parse(e.end) > from.toMillis();

/** Classes from Neptun, the user's own busy blocks, and planned study sessions of their groups. */
const busyEvents = (user: MockUser, from: DateTime, to: DateTime) =>
  [
    ...expandTimetable(user.calendar.timetable, from, to).filter((e) => !user.calendar.removedClassIds?.includes(e.id)),
    ...user.calendar.manualEvents.filter((e) => overlapsRange(e, from, to)),
    ...sessionEvents(user.me.id, from, to),
  ].sort((a, b) => a.start.localeCompare(b.start));

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CATEGORIES: Schemas['EventCategory'][] = ['CLASS', 'STUDY', 'WORK', 'OTHER'];
/** Ids expandTimetable gives Neptun class occurrences. */
const CLASS_ID_PREFIX = '00000000-0000-4000-8003-';

export const calendarHandlers = [
  http.get(
    url('/me/schedule'),
    authed((user, { request }) => {
      const r = range(request);
      if (r.error) return r.error;
      return HttpResponse.json<Schemas['CalendarEvent'][]>(busyEvents(user, r.from, r.to));
    }),
  ),

  http.post(
    url('/me/schedule'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['ManualEventInput'];
      const start = DateTime.fromISO(body.start ?? '');
      const end = DateTime.fromISO(body.end ?? '');
      const repeat = body.repeatWeeks ?? 0;
      const category = body.category ?? 'OTHER';
      const details: { path: string; issue: string }[] = [];
      if (!body.title?.trim() || body.title.length > 120) details.push({ path: 'title', issue: 'title is required (max 120)' });
      if (!start.isValid || !end.isValid || end <= start) details.push({ path: 'end', issue: 'end must be after start' });
      else if (end.diff(start, 'hours').hours > 24) details.push({ path: 'end', issue: 'a busy block can be at most 24 hours long' });
      if (!Number.isInteger(repeat) || repeat < 0 || repeat > 16) details.push({ path: 'repeatWeeks', issue: '0–16' });
      if (!CATEGORIES.includes(category)) details.push({ path: 'category', issue: `one of ${CATEGORIES.join(', ')}` });
      if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Request validation failed', details);

      // weekly copies keep the same Budapest local time across DST, like the real API
      const [s, e] = [start.setZone(ZONE), end.setZone(ZONE)];
      const created = Array.from({ length: repeat + 1 }, (_, week): Schemas['CalendarEvent'] => ({
        id: nextId(),
        title: body.title.trim(),
        start: toApiTime(s.plus({ weeks: week })),
        end: toApiTime(e.plus({ weeks: week })),
        room: null,
        subjectCode: null,
        source: 'MANUAL',
        category,
      }));
      user.calendar.manualEvents.push(...created);
      return HttpResponse.json<Schemas['CalendarEvent'][]>(created, { status: 201 });
    }),
  ),

  http.delete(
    url('/me/schedule/:eventId'),
    authed((user, { params }) => {
      const id = String(params.eventId);
      const cal = user.calendar;
      const session = [...db.groups.values()].filter((g) => isMember(g, user.me.id)).flatMap((g) => g.sessions).find((s) => s.id === id && s.status === 'PLANNED');
      if (cal.manualEvents.some((e) => e.id === id)) {
        cal.manualEvents = cal.manualEvents.filter((e) => e.id !== id);
      } else if (id.startsWith(CLASS_ID_PREFIX) && !cal.removedClassIds?.includes(id)) {
        // a Neptun class occurrence: remembered so it stays hidden
        cal.removedClassIds = [...(cal.removedClassIds ?? []), id];
      } else if (session) {
        // a study session: cancelled for the whole group, like the real API
        session.status = 'CANCELLED';
        const booking = session.bookingId ? db.bookings.get(session.bookingId) : undefined;
        if (booking) booking.status = 'CANCELLED';
      } else {
        return apiError(404, 'NOT_FOUND', 'Event not found');
      }
      return new HttpResponse(null, { status: 204 });
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
