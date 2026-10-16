import { DateTime } from 'luxon';

/** Everything user-facing is shown in Budapest time; the API speaks UTC ISO strings. */
export const ZONE = 'Europe/Budapest';

export const inZone = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
export const nowInZone = () => DateTime.now().setZone(ZONE);

/** Monday 00:00 (Budapest) of the week containing `d`. */
export const startOfWeek = (d: DateTime = nowInZone()) => d.setZone(ZONE).startOf('week');

/** UTC ISO without milliseconds, as the contract examples use: 2026-10-16T08:00:00Z */
export const toApiTime = (d: DateTime) => d.toUTC().toISO({ suppressMilliseconds: true })!;

export const formatTime = (iso: string) => inZone(iso).toFormat('HH:mm');
export const formatTimeRange = (start: string, end: string) => `${formatTime(start)}–${formatTime(end)}`;

/** "13–19 Oct 2026", or "29 Sep – 5 Oct 2026" across months. */
export function formatWeekRange(weekStart: DateTime) {
  const end = weekStart.plus({ days: 6 });
  return weekStart.month === end.month
    ? `${weekStart.toFormat('d')}–${end.toFormat('d LLL yyyy')}`
    : `${weekStart.toFormat('d LLL')} – ${end.toFormat('d LLL yyyy')}`;
}

export const minutesBetween = (a: string, b: string) => Math.round(inZone(b).diff(inZone(a), 'minutes').minutes);

/** "Tue 13 Oct · 12:00–14:00" */
export const formatSlot = (start: string, end: string) => `${inZone(start).toFormat('ccc d LLL')} · ${formatTimeRange(start, end)}`;
