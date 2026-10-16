import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { expandTimetable } from './calendar';
import { subjectById } from './data/subjects';
import { db } from './db';
import { isMember, type MockGroup } from './groups';

const overlaps = (a: { start: string; end: string }, start: string, end: string) => Date.parse(a.start) < Date.parse(end) && Date.parse(a.end) > Date.parse(start);

/**
 * Planned sessions of the user's groups, as STUDY_SESSION calendar events. This is what
 * AvailabilityService.upsertStudySessionBlock does on the server: sessions block future matching.
 */
export function sessionEvents(userId: string, from: DateTime, to: DateTime): Schemas['CalendarEvent'][] {
  const [f, t] = [from.toUTC().toISO()!, to.toUTC().toISO()!];
  return [...db.groups.values()]
    .filter((g) => isMember(g, userId))
    .flatMap((g) =>
      g.sessions
        .filter((s) => s.status === 'PLANNED' && overlaps(s, f, t))
        .map((s) => ({
          id: s.id,
          title: `Study session: ${g.name}`,
          start: s.start,
          end: s.end,
          room: s.location?.name ?? null,
          subjectCode: subjectById(g.subjectId)?.code ?? null,
          source: 'STUDY_SESSION' as const,
        })),
    );
}

/** Name of a member with a class or another planned session in [start, end), if any (mock: real users only). */
export function busyMember(group: MockGroup, start: string, end: string): string | null {
  const from = DateTime.fromISO(start);
  const to = DateTime.fromISO(end);
  for (const m of group.members) {
    const user = db.users.get(m.userId);
    if (!user) continue;
    const busy = [...expandTimetable(user.calendar.timetable, from, to), ...sessionEvents(user.me.id, from, to)];
    if (busy.some((e) => overlaps(e, start, end))) return user.me.displayName;
  }
  return null;
}
