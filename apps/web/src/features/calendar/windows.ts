import type { Schemas } from '@sgm/contracts';

export type WeeklyWindow = Schemas['WeeklyWindow'];

export const WEEKDAYS = [
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 7, short: 'Sun', long: 'Sunday' },
] as const;

/** The server default when a user never saved windows (ARCHITECTURE §4.1). */
export const defaultWindows = (): WeeklyWindow[] => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '08:00', endTime: '20:00' }));

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Problems per weekday (1–7): bad times, start ≥ end, or overlapping ranges on the same day. */
export function validateWindows(windows: WeeklyWindow[]): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const { day } of WEEKDAYS) {
    const ranges = windows.filter((w) => w.weekday === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const [i, w] of ranges.entries()) {
      if (!HHMM.test(w.startTime) || !HHMM.test(w.endTime)) errors[day] = 'Enter times as HH:mm.';
      else if (w.startTime >= w.endTime) errors[day] = 'Each range must end after it starts.';
      else if (i > 0 && w.startTime < ranges[i - 1].endTime) errors[day] = 'Ranges on the same day must not overlap.';
      if (errors[day]) break;
    }
  }
  return errors;
}

// Stopgap until the contract can return saved windows (docs/handoffs/fe-to-human-contract-availability-windows.md):
// remember the last windows this browser saved, per user.
const cacheKey = (userId: string) => `sgm.windows.${userId}`;

export function readCachedWindows(userId: string): WeeklyWindow[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as WeeklyWindow[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedWindows(userId: string, windows: WeeklyWindow[]) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(windows));
  } catch {
    // storage unavailable: the editor falls back to the default next time
  }
}
