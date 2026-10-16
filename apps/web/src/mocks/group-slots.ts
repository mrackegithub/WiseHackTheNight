import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { ZONE } from '../lib/time';
import { defaultWindows, expandTimetable, freeSlots } from './calendar';
import { people } from './data/people';
import { db } from './db';
import type { MockGroup } from './groups';

/**
 * Mock of getGroupSuggestedSlots: free slots of the group's real users (windows − classes), with each
 * seeded classmate deterministically busy in some of them. Ranked by "prefers everyone, ≥ 90 min,
 * daytime, soonest" (contract description).
 */
export function suggestedSlots(group: MockGroup, from: DateTime, to: DateTime, minMinutes: number): Schemas['SuggestedSlot'][] {
  const realUser = group.members.map((m) => db.users.get(m.userId)).find(Boolean);
  const base = realUser
    ? freeSlots(realUser.calendar.windows, expandTimetable(realUser.calendar.timetable, from, to), from, to, minMinutes)
    : freeSlots(defaultWindows(), [], from, to, minMinutes);

  const memberIds = group.members.map((m) => m.userId);
  const now = Date.now();

  return base
    .map((slot, k) => {
      const available = memberIds.filter((id) => {
        const i = people.findIndex((p) => p.user.id === id);
        return i < 0 || (k + i) % 4 !== 0; // seeded classmates are busy in every 4th slot (offset per person)
      });
      const minutes = (Date.parse(slot.end) - Date.parse(slot.start)) / 60_000;
      const startHour = DateTime.fromISO(slot.start, { zone: ZONE }).hour;
      const daysAhead = (Date.parse(slot.start) - now) / 86_400_000;
      const score =
        0.4 * (available.length / memberIds.length) +
        0.25 * Math.min(1, minutes / 90) +
        0.15 * (startHour >= 9 && startHour < 18 ? 1 : 0.5) +
        0.2 * Math.max(0, 1 - daysAhead / 14);
      return { ...slot, availableMemberIds: available, score: Math.round(score * 100) / 100 };
    })
    .filter((s) => s.availableMemberIds.length >= Math.min(2, memberIds.length))
    .sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
}
