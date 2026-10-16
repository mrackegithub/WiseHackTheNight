import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { expandWeeklyWindows, type WeeklyWindow } from '../src/slots/windows';
import { intersectSlots, slotDurationMinutes, subtractSlots } from '../src/slots/slots';
import type { TimeSlot } from '../src/ports';

describe('Europe/Budapest DST and timezone edge cases', () => {
  const zone = 'Europe/Budapest';

  describe('Spring forward (March 2026)', () => {
    // In Europe/Budapest, DST begins on Sunday 2026-03-29.
    // At 02:00, clocks jump to 03:00 (CET UTC+1 -> CEST UTC+2).
    // The day has only 23 hours.

    it('calculates real elapsed time correctly across spring forward transition', () => {
      // 01:00 local is 00:00 UTC (CET is UTC+1)
      const start = DateTime.fromISO('2026-03-29T01:00:00', { zone }).toJSDate();
      // 04:00 local is 02:00 UTC (CEST is UTC+2)
      const end = DateTime.fromISO('2026-03-29T04:00:00', { zone }).toJSDate();

      const slot: TimeSlot = { start, end };
      // Wall clock looks like 3 hours (01:00 to 04:00), but real elapsed duration is 2 hours (120 minutes)
      expect(slotDurationMinutes(slot)).toBe(120);
    });

    it('expands weekly window on spring forward Sunday with correct UTC timestamps', () => {
      // Sunday (ISO 7) window from 08:00 to 12:00 Europe/Budapest
      const window: WeeklyWindow = {
        weekday: 7,
        startTime: '08:00',
        endTime: '12:00',
      };

      const range: TimeSlot = {
        start: DateTime.fromISO('2026-03-29T00:00:00', { zone }).toJSDate(),
        end: DateTime.fromISO('2026-03-29T23:59:59', { zone }).toJSDate(),
      };

      const slots = expandWeeklyWindows([window], range, zone);
      expect(slots).toHaveLength(1);

      // On March 29, 08:00 CEST is 06:00 UTC (UTC+2)
      expect(slots[0].start.toISOString()).toBe('2026-03-29T06:00:00.000Z');
      expect(slots[0].end.toISOString()).toBe('2026-03-29T10:00:00.000Z');
      expect(slotDurationMinutes(slots[0])).toBe(240); // 4 hours
    });
  });

  describe('Fall back (October 2026)', () => {
    // In Europe/Budapest, DST ends on Sunday 2026-10-25.
    // At 03:00, clocks jump back to 02:00 (CEST UTC+2 -> CET UTC+1).
    // The day has 25 hours.

    it('calculates real elapsed time correctly across fall back transition', () => {
      // Start at 01:00 CEST (2026-10-24T23:00:00Z)
      const start = DateTime.fromISO('2026-10-25T01:00:00', { zone }).toJSDate();
      // End at 04:00 CET (2026-10-25T03:00:00Z)
      const end = DateTime.fromISO('2026-10-25T04:00:00', { zone }).toJSDate();

      const slot: TimeSlot = { start, end };
      // Wall clock looks like 3 hours (01:00 to 04:00), but real elapsed duration is 4 hours (240 minutes)
      expect(slotDurationMinutes(slot)).toBe(240);
    });

    it('expands weekly window on fall back Sunday with correct UTC timestamps', () => {
      // Sunday (ISO 7) window from 08:00 to 12:00 Europe/Budapest
      const window: WeeklyWindow = {
        weekday: 7,
        startTime: '08:00',
        endTime: '12:00',
      };

      const range: TimeSlot = {
        start: DateTime.fromISO('2026-10-25T00:00:00', { zone }).toJSDate(),
        end: DateTime.fromISO('2026-10-25T23:59:59', { zone }).toJSDate(),
      };

      const slots = expandWeeklyWindows([window], range, zone);
      expect(slots).toHaveLength(1);

      // On October 25, 08:00 CET is 07:00 UTC (UTC+1)
      expect(slots[0].start.toISOString()).toBe('2026-10-25T07:00:00.000Z');
      expect(slots[0].end.toISOString()).toBe('2026-10-25T11:00:00.000Z');
      expect(slotDurationMinutes(slots[0])).toBe(240); // 4 hours
    });
  });

  describe('Standard vs Daylight offset throughout the year', () => {
    it('Monday 08:00-10:00 in January is UTC+1 (07:00-09:00 UTC)', () => {
      const window: WeeklyWindow = {
        weekday: 1, // Monday
        startTime: '08:00',
        endTime: '10:00',
      };

      const range: TimeSlot = {
        start: new Date('2026-01-12T00:00:00Z'),
        end: new Date('2026-01-12T23:59:59Z'),
      };

      const slots = expandWeeklyWindows([window], range, zone);
      expect(slots).toHaveLength(1);
      expect(slots[0].start.toISOString()).toBe('2026-01-12T07:00:00.000Z');
      expect(slots[0].end.toISOString()).toBe('2026-01-12T09:00:00.000Z');
    });

    it('Monday 08:00-10:00 in July is UTC+2 (06:00-08:00 UTC)', () => {
      const window: WeeklyWindow = {
        weekday: 1, // Monday
        startTime: '08:00',
        endTime: '10:00',
      };

      const range: TimeSlot = {
        start: new Date('2026-07-13T00:00:00Z'),
        end: new Date('2026-07-13T23:59:59Z'),
      };

      const slots = expandWeeklyWindows([window], range, zone);
      expect(slots).toHaveLength(1);
      expect(slots[0].start.toISOString()).toBe('2026-07-13T06:00:00.000Z');
      expect(slots[0].end.toISOString()).toBe('2026-07-13T08:00:00.000Z');
    });
  });

  describe('Slot intersection and subtraction across DST boundaries', () => {
    it('properly subtracts busy slot spanning DST change', () => {
      // Free window: 2026-03-29 00:00 UTC to 04:00 UTC
      const free: TimeSlot[] = [
        {
          start: new Date('2026-03-29T00:00:00Z'),
          end: new Date('2026-03-29T04:00:00Z'),
        },
      ];
      // Busy event in the middle: 01:00 UTC to 02:00 UTC
      const busy: TimeSlot[] = [
        {
          start: new Date('2026-03-29T01:00:00Z'),
          end: new Date('2026-03-29T02:00:00Z'),
        },
      ];

      const remaining = subtractSlots(free, busy, 30);
      expect(remaining).toHaveLength(2);
      expect(remaining[0].start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
      expect(remaining[0].end.toISOString()).toBe('2026-03-29T01:00:00.000Z');
      expect(remaining[1].start.toISOString()).toBe('2026-03-29T02:00:00.000Z');
      expect(remaining[1].end.toISOString()).toBe('2026-03-29T04:00:00.000Z');
    });

    it('intersects slots spanning DST boundary with accurate millisecond precision', () => {
      const userA: TimeSlot[] = [
        {
          start: new Date('2026-10-25T01:00:00Z'),
          end: new Date('2026-10-25T03:30:00Z'),
        },
      ];
      const userB: TimeSlot[] = [
        {
          start: new Date('2026-10-25T02:00:00Z'),
          end: new Date('2026-10-25T05:00:00Z'),
        },
      ];

      const overlap = intersectSlots(userA, userB, 30);
      expect(overlap).toHaveLength(1);
      expect(overlap[0].start.toISOString()).toBe('2026-10-25T02:00:00.000Z');
      expect(overlap[0].end.toISOString()).toBe('2026-10-25T03:30:00.000Z');
      expect(slotDurationMinutes(overlap[0])).toBe(90);
    });
  });
});

