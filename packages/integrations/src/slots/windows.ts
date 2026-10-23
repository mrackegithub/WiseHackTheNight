import { DateTime } from 'luxon';
import type { TimeSlot } from '../ports';
import { mergeSlots } from './slots';

export interface WeeklyWindow {
  weekday: number; // 1 = Monday, 7 = Sunday (ISO)
  startTime: string; // "HH:mm" Europe/Budapest
  endTime: string; // "HH:mm" Europe/Budapest
}

/**
 * Expands a set of recurring weekly windows into concrete TimeSlots within a date range.
 * Timezone defaults to Europe/Budapest as per system architecture.
 * Automatically accounts for DST transitions (23h spring forward / 25h fall back).
 */
export function expandWeeklyWindows(
  windows: WeeklyWindow[],
  range: TimeSlot,
  zone = 'Europe/Budapest',
): TimeSlot[] {
  if (windows.length === 0 || range.end.getTime() <= range.start.getTime()) {
    return [];
  }

  // Parse windows into parsed hour/minute components
  const parsedWindows = windows
    .map((w) => {
      const [sh, sm] = w.startTime.split(':').map((v) => parseInt(v, 10));
      const [eh, em] = w.endTime.split(':').map((v) => parseInt(v, 10));
      return {
        weekday: w.weekday,
        startHour: sh,
        startMinute: sm,
        endHour: eh,
        endMinute: em,
      };
    })
    .filter(
      (w) =>
        !isNaN(w.startHour) &&
        !isNaN(w.startMinute) &&
        !isNaN(w.endHour) &&
        !isNaN(w.endMinute) &&
        w.startHour >= 0 &&
        w.startHour <= 23 &&
        w.endHour >= 0 &&
        w.endHour <= 23 &&
        w.startMinute >= 0 &&
        w.startMinute <= 59 &&
        w.endMinute >= 0 &&
        w.endMinute <= 59 &&
        (w.endHour > w.startHour || (w.endHour === w.startHour && w.endMinute > w.startMinute)),
    );

  if (parsedWindows.length === 0) return [];

  // Start at the start of the day in the target timezone
  let currentDay = DateTime.fromJSDate(range.start, { zone }).startOf('day');
  const endLimit = DateTime.fromJSDate(range.end, { zone });

  const rawSlots: TimeSlot[] = [];

  while (currentDay <= endLimit) {
    const isoWeekday = currentDay.weekday; // 1 (Mon) - 7 (Sun) in Luxon

    const matching = parsedWindows.filter((w) => w.weekday === isoWeekday);

    for (const w of matching) {
      const slotStart = currentDay.set({
        hour: w.startHour,
        minute: w.startMinute,
        second: 0,
        millisecond: 0,
      });

      const slotEnd = currentDay.set({
        hour: w.endHour,
        minute: w.endMinute,
        second: 0,
        millisecond: 0,
      });

      const jsStart = slotStart.toJSDate();
      const jsEnd = slotEnd.toJSDate();

      // Clip to requested range
      const clippedStart = new Date(Math.max(jsStart.getTime(), range.start.getTime()));
      const clippedEnd = new Date(Math.min(jsEnd.getTime(), range.end.getTime()));

      if (clippedEnd.getTime() > clippedStart.getTime()) {
        rawSlots.push({
          start: clippedStart,
          end: clippedEnd,
        });
      }
    }

    currentDay = currentDay.plus({ days: 1 });
  }

  return mergeSlots(rawSlots);
}

