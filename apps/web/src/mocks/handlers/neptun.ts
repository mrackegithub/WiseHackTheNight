import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { sampleTimetable } from '../calendar';
import { subjects } from '../data/subjects';
import type { MockUser } from '../db';
import { apiError, authed, url } from '../utils';

/** Mock feeds: any URL containing "unreachable" fails like a dead Neptun link. */
const isBroken = (icsUrl: string) => icsUrl.includes('unreachable');
const EVENTS_PER_SYNC = 112; // ~7 classes/week × 16 weeks

/** "Course codes found in SUMMARY/DESCRIPTION are added to /me/subjects as PEER" (ARCHITECTURE §4.1). */
function linkSubjects(user: MockUser) {
  const have = new Set(user.subjects.map((s) => s.subject.code));
  const found = [...new Set(sampleTimetable.map((e) => e.subjectCode))].filter((code) => !have.has(code));
  for (const code of found) {
    const subject = subjects.find((s) => s.code === code);
    if (subject) user.subjects.push({ subject, role: 'PEER', confidence: 3 });
  }
  return found.length;
}

/** What a successful import does on the server; exported so tests can apply it directly. */
export function importTimetable(user: MockUser, connected: boolean): Schemas['SyncResult'] {
  const wasEmpty = user.calendar.timetable.length === 0;
  const syncedAt = new Date().toISOString();
  user.calendar.timetable = sampleTimetable;
  user.calendar.neptun = { connected, status: 'OK', lastSyncedAt: syncedAt, lastError: null, eventCount: EVENTS_PER_SYNC };
  return { imported: wasEmpty ? EVENTS_PER_SYNC : 0, removed: 0, subjectsLinked: linkSubjects(user), syncedAt };
}

export const neptunHandlers = [
  http.get(
    url('/integrations/neptun'),
    authed((user) => HttpResponse.json<Schemas['NeptunConnection']>(user.calendar.neptun)),
  ),

  http.put(
    url('/integrations/neptun'),
    authed(async (user, { request }) => {
      const { icsUrl } = (await request.json()) as { icsUrl?: string };
      if (!icsUrl || !/^(https?|webcal):\/\/\S+$/i.test(icsUrl)) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid calendar link', [{ path: 'icsUrl', issue: 'must be an http(s):// or webcal:// link' }]);
      }
      user.calendar.icsUrl = icsUrl;
      if (isBroken(icsUrl)) {
        user.calendar.neptun = { connected: true, status: 'ERROR', lastSyncedAt: null, lastError: 'Could not download the calendar (HTTP 404).', eventCount: 0 };
      } else {
        importTimetable(user, true);
      }
      return HttpResponse.json<Schemas['NeptunConnection']>(user.calendar.neptun);
    }),
  ),

  http.delete(
    url('/integrations/neptun'),
    authed((user) => {
      user.calendar.icsUrl = null;
      user.calendar.timetable = [];
      user.calendar.removedClassIds = [];
      user.calendar.neptun = { connected: false, status: 'NOT_CONNECTED', lastSyncedAt: null, lastError: null, eventCount: 0 };
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  http.post(
    url('/integrations/neptun/upload'),
    authed(async (user, { request }) => {
      const file = (await request.formData()).get('file');
      if (!file || typeof file === 'string') return apiError(422, 'VALIDATION_FAILED', 'File missing', [{ path: 'file', issue: 'required' }]);
      if (file.size > 2 * 1024 * 1024) return apiError(422, 'VALIDATION_FAILED', 'File too large', [{ path: 'file', issue: 'max 2 MB' }]);
      if (!(await file.text()).trimStart().startsWith('BEGIN:VCALENDAR')) {
        return apiError(422, 'VALIDATION_FAILED', 'Not an iCalendar file', [{ path: 'file', issue: 'must be an .ics (iCalendar) file' }]);
      }
      return HttpResponse.json<Schemas['SyncResult']>(importTimetable(user, user.calendar.neptun.connected));
    }),
  ),

  http.post(
    url('/integrations/neptun/sync'),
    authed((user) => {
      const { icsUrl } = user.calendar;
      if (!user.calendar.neptun.connected || !icsUrl) return apiError(409, 'CONFLICT', 'Neptun is not connected');
      if (isBroken(icsUrl)) return apiError(502, 'NEPTUN_UNREACHABLE', 'Neptun calendar could not be fetched');
      return HttpResponse.json<Schemas['SyncResult']>(importTimetable(user, true));
    }),
  ),
];
