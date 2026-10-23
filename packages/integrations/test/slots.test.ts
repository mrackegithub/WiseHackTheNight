import { describe, expect, it } from 'vitest';
import {
  intersectMultipleSlots,
  intersectSlots,
  mergeSlots,
  slotDurationMinutes,
  subtractSlots,
  totalDurationMinutes,
} from '../src/slots/slots';
import { expandWeeklyWindows, type WeeklyWindow } from '../src/slots/windows';
import type { TimeSlot } from '../src/ports';

function makeSlot(isoStart: string, isoEnd: string): TimeSlot {
  return {
    start: new Date(isoStart),
    end: new Date(isoEnd),
  };
}

describe('mergeSlots', () => {
  it('returns empty array when given empty array', () => {
    expect(mergeSlots([])).toEqual([]);
  });

  it('filters out invalid or zero-duration slots', () => {
    const invalid = [
      makeSlot('2026-04-10T10:00:00Z', '2026-04-10T10:00:00Z'),
      makeSlot('2026-04-10T12:00:00Z', '2026-04-10T11:00:00Z'),
    ];
    expect(mergeSlots(invalid)).toEqual([]);
  });

  it('preserves single valid slot', () => {
    const slot = makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z');
    expect(mergeSlots([slot])).toEqual([slot]);
  });

  it('merges overlapping slots', () => {
    const slots = [
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z'),
      makeSlot('2026-04-10T09:30:00Z', '2026-04-10T11:30:00Z'),
    ];
    const merged = mergeSlots(slots);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2026-04-10T11:30:00.000Z');
  });

  it('merges contiguous (abutting) slots', () => {
    const slots = [
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z'),
      makeSlot('2026-04-10T10:00:00Z', '2026-04-10T12:00:00Z'),
    ];
    const merged = mergeSlots(slots);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2026-04-10T12:00:00.000Z');
  });

  it('sorts and leaves disjoint slots separate', () => {
    const slots = [
      makeSlot('2026-04-10T14:00:00Z', '2026-04-10T16:00:00Z'),
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z'),
    ];
    const merged = mergeSlots(slots);
    expect(merged).toHaveLength(2);
    expect(merged[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(merged[1].start.toISOString()).toBe('2026-04-10T14:00:00.000Z');
  });

  it('handles fully contained slots', () => {
    const slots = [
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z'),
      makeSlot('2026-04-10T09:00:00Z', '2026-04-10T10:00:00Z'),
    ];
    const merged = mergeSlots(slots);
    expect(merged).toHaveLength(1);
    expect(merged[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(merged[0].end.toISOString()).toBe('2026-04-10T12:00:00.000Z');
  });
});

describe('subtractSlots', () => {
  it('returns original source if busy is empty', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z')];
    expect(subtractSlots(source, [])).toEqual(source);
  });

  it('returns empty when busy covers entire source slot', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z')];
    const busy = [makeSlot('2026-04-10T07:00:00Z', '2026-04-10T13:00:00Z')];
    expect(subtractSlots(source, busy)).toEqual([]);
  });

  it('chops busy slot out from the middle into two slots', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T14:00:00Z')];
    const busy = [makeSlot('2026-04-10T10:00:00Z', '2026-04-10T11:00:00Z')];
    const result = subtractSlots(source, busy);
    expect(result).toHaveLength(2);
    expect(result[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T10:00:00.000Z');
    expect(result[1].start.toISOString()).toBe('2026-04-10T11:00:00.000Z');
    expect(result[1].end.toISOString()).toBe('2026-04-10T14:00:00.000Z');
  });

  it('truncates start of source slot', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z')];
    const busy = [makeSlot('2026-04-10T07:30:00Z', '2026-04-10T09:00:00Z')];
    const result = subtractSlots(source, busy);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T12:00:00.000Z');
  });

  it('truncates end of source slot', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z')];
    const busy = [makeSlot('2026-04-10T11:00:00Z', '2026-04-10T13:00:00Z')];
    const result = subtractSlots(source, busy);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T08:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T11:00:00.000Z');
  });

  it('filters out remaining slots shorter than minMinutes', () => {
    const source = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z')];
    // Leaves 15 min at start (08:00-08:15) and 60 min at end (09:00-10:00)
    const busy = [makeSlot('2026-04-10T08:15:00Z', '2026-04-10T09:00:00Z')];
    const result = subtractSlots(source, busy, 30);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T10:00:00.000Z');
  });

  it('handles multiple busy slots on multiple source slots', () => {
    const source = [
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z'),
      makeSlot('2026-04-10T14:00:00Z', '2026-04-10T18:00:00Z'),
    ];
    const busy = [
      makeSlot('2026-04-10T09:00:00Z', '2026-04-10T10:00:00Z'),
      makeSlot('2026-04-10T15:00:00Z', '2026-04-10T16:00:00Z'),
    ];
    const result = subtractSlots(source, busy, 30);
    expect(result).toHaveLength(4);
  });
});

describe('intersectSlots', () => {
  it('returns empty when either list is empty', () => {
    const slot = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z')];
    expect(intersectSlots([], slot)).toEqual([]);
    expect(intersectSlots(slot, [])).toEqual([]);
  });

  it('returns empty when slots are disjoint', () => {
    const a = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z')];
    const b = [makeSlot('2026-04-10T10:30:00Z', '2026-04-10T12:00:00Z')];
    expect(intersectSlots(a, b)).toEqual([]);
  });

  it('returns empty when slots are touching/abutting', () => {
    const a = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z')];
    const b = [makeSlot('2026-04-10T10:00:00Z', '2026-04-10T12:00:00Z')];
    expect(intersectSlots(a, b)).toEqual([]);
  });

  it('finds intersection of overlapping slots with default minMinutes=30', () => {
    const a = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T11:00:00Z')];
    const b = [makeSlot('2026-04-10T09:00:00Z', '2026-04-10T12:00:00Z')];
    const result = intersectSlots(a, b);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T11:00:00.000Z');
  });

  it('respects minMinutes threshold', () => {
    const a = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T09:20:00Z')];
    const b = [makeSlot('2026-04-10T09:00:00Z', '2026-04-10T11:00:00Z')];
    // Overlap is 20 minutes (09:00 - 09:20)
    expect(intersectSlots(a, b, 30)).toEqual([]);
    expect(intersectSlots(a, b, 15)).toHaveLength(1);
    expect(intersectSlots(a, b, 20)).toHaveLength(1);
  });

  it('correctly handles one slot intersecting multiple slots', () => {
    const a = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z')];
    const b = [
      makeSlot('2026-04-10T09:00:00Z', '2026-04-10T11:00:00Z'),
      makeSlot('2026-04-10T13:00:00Z', '2026-04-10T15:00:00Z'),
    ];
    const result = intersectSlots(a, b);
    expect(result).toHaveLength(2);
    expect(result[0].start.toISOString()).toBe('2026-04-10T09:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T11:00:00.000Z');
    expect(result[1].start.toISOString()).toBe('2026-04-10T13:00:00.000Z');
    expect(result[1].end.toISOString()).toBe('2026-04-10T15:00:00.000Z');
  });
});

describe('intersectMultipleSlots', () => {
  it('handles 0 or 1 lists', () => {
    expect(intersectMultipleSlots([])).toEqual([]);
    const single = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z')];
    expect(intersectMultipleSlots([single])).toEqual(single);
  });

  it('finds mutual availability among 3 participants', () => {
    const userA = [makeSlot('2026-04-10T08:00:00Z', '2026-04-10T14:00:00Z')];
    const userB = [makeSlot('2026-04-10T10:00:00Z', '2026-04-10T16:00:00Z')];
    const userC = [makeSlot('2026-04-10T11:00:00Z', '2026-04-10T13:00:00Z')];

    const result = intersectMultipleSlots([userA, userB, userC], 30);
    expect(result).toHaveLength(1);
    expect(result[0].start.toISOString()).toBe('2026-04-10T11:00:00.000Z');
    expect(result[0].end.toISOString()).toBe('2026-04-10T13:00:00.000Z');
  });
});

describe('duration helpers', () => {
  it('slotDurationMinutes calculates accurate minutes', () => {
    const slot = makeSlot('2026-04-10T08:00:00Z', '2026-04-10T09:45:00Z');
    expect(slotDurationMinutes(slot)).toBe(105);
  });

  it('totalDurationMinutes merges overlapping slots before summing', () => {
    const slots = [
      makeSlot('2026-04-10T08:00:00Z', '2026-04-10T10:00:00Z'), // 120m
      makeSlot('2026-04-10T09:00:00Z', '2026-04-10T11:00:00Z'), // overlaps 09-10, total 08-11 is 180m
    ];
    expect(totalDurationMinutes(slots)).toBe(180);
  });
});

describe('expandWeeklyWindows boundary checks', () => {
  const range: TimeSlot = {
    start: new Date('2026-04-13T00:00:00Z'), // Monday
    end: new Date('2026-04-19T23:59:59Z'), // Sunday
  };

  it('rejects invalid hours (< 0 or > 23)', () => {
    const invalidWindows: WeeklyWindow[] = [
      { weekday: 1, startTime: '-1:00', endTime: '10:00' },
      { weekday: 1, startTime: '24:00', endTime: '25:00' },
      { weekday: 1, startTime: '10:00', endTime: '24:00' },
    ];
    expect(expandWeeklyWindows(invalidWindows, range)).toEqual([]);
  });

  it('rejects invalid minutes (< 0 or > 59)', () => {
    const invalidWindows: WeeklyWindow[] = [
      { weekday: 1, startTime: '09:-5', endTime: '10:00' },
      { weekday: 1, startTime: '09:60', endTime: '10:00' },
      { weekday: 1, startTime: '09:00', endTime: '10:60' },
    ];
    expect(expandWeeklyWindows(invalidWindows, range)).toEqual([]);
  });

  it('rejects end time that is not strictly after start time', () => {
    const invalidWindows: WeeklyWindow[] = [
      { weekday: 1, startTime: '10:00', endTime: '10:00' },
      { weekday: 1, startTime: '12:00', endTime: '10:00' },
      { weekday: 1, startTime: '10:30', endTime: '10:15' },
    ];
    expect(expandWeeklyWindows(invalidWindows, range)).toEqual([]);
  });

  it('accepts valid boundary hours and minutes (00:00 to 23:59)', () => {
    const validWindows: WeeklyWindow[] = [
      { weekday: 1, startTime: '00:00', endTime: '23:59' },
    ];
    const slots = expandWeeklyWindows(validWindows, range);
    expect(slots.length).toBeGreaterThan(0);
  });
});

