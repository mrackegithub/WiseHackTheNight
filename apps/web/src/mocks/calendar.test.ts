import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { ZONE } from '../lib/time';
import { expandTimetable, freeSlots, sampleTimetable } from './calendar';

const day = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

describe('mock calendar', () => {
  it('expands the weekly timetable into UTC events for the requested range', () => {
    // Monday 12 Oct 2026, CEST (UTC+2)
    const events = expandTimetable(sampleTimetable, day('2026-10-12T00:00'), day('2026-10-13T00:00'));
    expect(events.map((e) => [e.start, e.end])).toEqual([
      ['2026-10-12T08:00:00Z', '2026-10-12T09:30:00Z'],
      ['2026-10-12T12:00:00Z', '2026-10-12T13:30:00Z'],
    ]);
  });

  it('follows the DST switch (classes stay at 10:00 local time)', () => {
    // 26 Oct 2026 is the first Monday after the switch to CET (UTC+1)
    const [first] = expandTimetable(sampleTimetable, day('2026-10-26T00:00'), day('2026-10-27T00:00'));
    expect(first.start).toBe('2026-10-26T09:00:00Z');
  });

  it('computes free slots as window minus busy time, dropping gaps under 30 min', () => {
    const windows = [{ weekday: 1, startTime: '08:00', endTime: '12:00' }];
    const busy = [
      { start: '2026-10-12T07:00:00Z', end: '2026-10-12T07:40:00Z' }, // 09:00–09:40 local
      { start: '2026-10-12T07:50:00Z', end: '2026-10-12T08:30:00Z' }, // 09:50–10:30 → 10-min gap dropped
    ];
    expect(freeSlots(windows, busy, day('2026-10-12T00:00'), day('2026-10-13T00:00'))).toEqual([
      { start: '2026-10-12T06:00:00Z', end: '2026-10-12T07:00:00Z' },
      { start: '2026-10-12T08:30:00Z', end: '2026-10-12T10:00:00Z' },
    ]);
  });
});
