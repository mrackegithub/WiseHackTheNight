import { inZone, toApiTime } from '../../lib/time';

const STEP_MIN = 15;
const MIN_SESSION = 30;
const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

/** Possible start times inside a free slot, every 15 min, leaving room for at least 30 min. */
export function startOptions(slot: { start: string; end: string }): string[] {
  const end = inZone(slot.end);
  const options: string[] = [];
  // round the first option up to the next quarter hour
  let t = inZone(slot.start);
  if (t.minute % STEP_MIN || t.second) t = t.set({ minute: Math.ceil((t.minute + 1) / STEP_MIN) * STEP_MIN, second: 0, millisecond: 0 });
  for (; t.plus({ minutes: MIN_SESSION }) <= end; t = t.plus({ minutes: STEP_MIN })) options.push(toApiTime(t));
  return options;
}

/** Durations that fit between `start` and the end of the slot. */
export function durationOptions(slotEnd: string, start: string): number[] {
  const room = inZone(slotEnd).diff(inZone(start), 'minutes').minutes;
  return DURATIONS.filter((d) => d <= room);
}

/** The preferred length if it fits, else the longest that does. */
export function defaultDuration(options: number[], preferred: number) {
  if (options.includes(preferred)) return preferred;
  return options.filter((d) => d <= preferred).at(-1) ?? options[0];
}

export const addMinutes = (iso: string, minutes: number) => toApiTime(inZone(iso).plus({ minutes }));
