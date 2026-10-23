import type { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { inZone } from '../../lib/time';

export const DEFAULT_START_HOUR = 7;
export const DEFAULT_END_HOUR = 21;
export const HOUR_PX = 44;

export interface Block {
  key: string;
  top: number;
  height: number;
  start: string;
  end: string;
}

/** Clips [start, end) to the visible hours of `day` and converts to pixel offsets. */
export function place(day: DateTime, start: string, end: string, key: string, startHour: number, endHour: number): Block | null {
  const visibleStart = startHour === 0 ? day.startOf('day') : day.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
  const visibleEnd = endHour === 24 ? day.plus({ days: 1 }).startOf('day') : day.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
  const evStart = inZone(start);
  const evEnd = inZone(end);
  const s = evStart < visibleStart ? visibleStart : evStart;
  const e = evEnd > visibleEnd ? visibleEnd : evEnd;
  if (e <= s) return null;
  const minutesFromTop = s.diff(visibleStart, 'minutes').minutes;
  const heightMinutes = e.diff(s, 'minutes').minutes;
  if (heightMinutes <= 0) return null;
  return { key, top: (minutesFromTop / 60) * HOUR_PX, height: (heightMinutes / 60) * HOUR_PX, start, end };
}

/** Computes visible start and end hours from the week's events, clamped to 0–24. */
export function computeVisibleRange(events: Schemas['CalendarEvent'][], days: DateTime[]): { startHour: number; endHour: number } {
  if (events.length === 0 || days.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  let earliestStart = DEFAULT_START_HOUR;
  let latestEnd = DEFAULT_END_HOUR;

  for (const day of days) {
    const dayStart = day.startOf('day');
    const dayEnd = day.plus({ days: 1 }).startOf('day');

    for (const ev of events) {
      const evStart = inZone(ev.start);
      const evEnd = inZone(ev.end);

      if (evEnd > dayStart && evStart < dayEnd) {
        const segStart = evStart < dayStart ? dayStart : evStart;
        const segEnd = evEnd > dayEnd ? dayEnd : evEnd;

        const startHour = segStart.diff(dayStart, 'minutes').minutes / 60;
        const endHour = segEnd.diff(dayStart, 'minutes').minutes / 60;

        if (startHour < earliestStart) {
          earliestStart = startHour;
        }
        if (endHour > latestEnd) {
          latestEnd = endHour;
        }
      }
    }
  }

  const start = Math.max(0, Math.min(24, Math.min(DEFAULT_START_HOUR, Math.floor(earliestStart))));
  const end = Math.max(0, Math.min(24, Math.max(DEFAULT_END_HOUR, Math.ceil(latestEnd))));

  return { startHour: start, endHour: end };
}
