import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { toApiTime, ZONE } from '../lib/time';

/** A recurring weekly class, like one RRULE in a Neptun iCal feed. */
export interface TimetableEntry {
  weekday: number; // 1 = Monday (ISO)
  start: string; // HH:mm Budapest
  end: string;
  title: string;
  room: string;
  subjectCode: string;
}

/** What the demo user's Neptun calendar contains. */
export const sampleTimetable: TimetableEntry[] = [
  { weekday: 1, start: '10:00', end: '11:30', title: 'Algorithms and Data Structures I (lecture)', room: 'Déli Tömb 0-822', subjectCode: 'IP-18AA1E' },
  { weekday: 1, start: '14:00', end: '15:30', title: 'Databases I (practice)', room: 'Déli Tömb 2-124', subjectCode: 'IP-18AB1E' },
  { weekday: 2, start: '08:15', end: '09:45', title: 'Analysis I (lecture)', room: 'Északi Tömb 0-100', subjectCode: 'IP-18ANA1E' },
  { weekday: 2, start: '12:00', end: '13:30', title: 'Algorithms and Data Structures I (practice)', room: 'Déli Tömb 2-202', subjectCode: 'IP-18AA1E' },
  { weekday: 3, start: '10:00', end: '12:00', title: 'Analysis I (practice)', room: 'Déli Tömb 0-313', subjectCode: 'IP-18ANA1E' },
  { weekday: 4, start: '16:00', end: '17:30', title: 'Databases I (lecture)', room: 'Északi Tömb 0-821', subjectCode: 'IP-18AB1E' },
  { weekday: 5, start: '09:00', end: '10:30', title: 'Discrete Mathematics I (lecture)', room: 'Déli Tömb 0-822', subjectCode: 'IP-18DM1E' },
];

export const defaultWindows = (): Schemas['WeeklyWindow'][] =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '08:00', endTime: '20:00' }));

const at = (day: DateTime, hhmm: string) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 });
};

/** Each Budapest calendar day overlapping [from, to). */
function daysIn(from: DateTime, to: DateTime) {
  const days: DateTime[] = [];
  for (let d = from.setZone(ZONE).startOf('day'); d < to; d = d.plus({ days: 1 })) days.push(d);
  return days;
}

/** Expands the timetable into concrete events in [from, to). Ids are stable per (date, entry). */
export function expandTimetable(timetable: TimetableEntry[], from: DateTime, to: DateTime): Schemas['CalendarEvent'][] {
  return daysIn(from, to).flatMap((day) =>
    timetable.flatMap((entry, i) => {
      if (entry.weekday !== day.weekday) return [];
      const start = at(day, entry.start);
      const end = at(day, entry.end);
      if (end <= from || start >= to) return [];
      const id = `00000000-0000-4000-8003-${(Number(day.toFormat('yyyyMMdd')) * 100 + i).toString().padStart(12, '0')}`;
      return [{ id, title: entry.title, start: toApiTime(start), end: toApiTime(end), room: entry.room, subjectCode: entry.subjectCode, source: 'NEPTUN' as const }];
    }),
  );
}

type Interval = [number, number]; // epoch ms

/** Free slots = weekly windows − busy events, clipped to [from, to), each ≥ minMinutes (ARCHITECTURE §4.1). */
export function freeSlots(
  windows: Schemas['WeeklyWindow'][],
  busy: Pick<Schemas['CalendarEvent'], 'start' | 'end'>[],
  from: DateTime,
  to: DateTime,
  minMinutes = 30,
): Schemas['TimeSlot'][] {
  const busyMs: Interval[] = busy.map((e) => [Date.parse(e.start), Date.parse(e.end)]).sort((a, b) => a[0] - b[0]) as Interval[];
  const result: Schemas['TimeSlot'][] = [];

  for (const day of daysIn(from, to)) {
    for (const w of windows.filter((x) => x.weekday === day.weekday)) {
      let cursor = Math.max(at(day, w.startTime).toMillis(), from.toMillis());
      const windowEnd = Math.min(at(day, w.endTime).toMillis(), to.toMillis());
      const pieces: Interval[] = [];
      for (const [bs, be] of busyMs) {
        if (be <= cursor || bs >= windowEnd) continue;
        if (bs > cursor) pieces.push([cursor, bs]);
        cursor = Math.max(cursor, be);
      }
      if (cursor < windowEnd) pieces.push([cursor, windowEnd]);
      for (const [s, e] of pieces) {
        if (e - s >= minMinutes * 60_000) {
          result.push({ start: toApiTime(DateTime.fromMillis(s)), end: toApiTime(DateTime.fromMillis(e)) });
        }
      }
    }
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}
