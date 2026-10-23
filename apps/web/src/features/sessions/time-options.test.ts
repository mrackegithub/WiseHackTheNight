import { describe, expect, it } from 'vitest';
import { addMinutes, defaultDuration, durationOptions, startOptions } from './time-options';

describe('session time options', () => {
  it('offers quarter-hour starts that leave at least 30 minutes', () => {
    // 11:30–13:00 Budapest (CEST)
    expect(startOptions({ start: '2026-10-12T09:30:00Z', end: '2026-10-12T11:00:00Z' })).toEqual([
      '2026-10-12T09:30:00Z',
      '2026-10-12T09:45:00Z',
      '2026-10-12T10:00:00Z',
      '2026-10-12T10:15:00Z',
      '2026-10-12T10:30:00Z',
    ]);
  });

  it('rounds an odd slot start up to the next quarter hour', () => {
    expect(startOptions({ start: '2026-10-12T09:37:00Z', end: '2026-10-12T10:30:00Z' })[0]).toBe('2026-10-12T09:45:00Z');
  });

  it('falls back to raw start for unaligned slots when rounding up exceeds end', () => {
    // 30 min unaligned slot: 09:37 - 10:07. Rounding up to 09:45 would leave only 22 min (< 30 min)
    expect(startOptions({ start: '2026-10-12T09:37:00Z', end: '2026-10-12T10:07:00Z' })).toEqual([
      '2026-10-12T09:37:00Z',
    ]);
  });

  it('only offers durations that fit, and picks the preferred one when possible', () => {
    const options = durationOptions('2026-10-12T11:00:00Z', '2026-10-12T09:30:00Z'); // 90 min of room
    expect(options).toEqual([30, 45, 60, 90]);
    expect(defaultDuration(options, 90)).toBe(90);
    expect(defaultDuration(options, 120)).toBe(90);
    expect(defaultDuration([30, 45], 90)).toBe(45);
  });

  it('adds minutes in UTC ISO', () => {
    expect(addMinutes('2026-10-12T09:30:00Z', 90)).toBe('2026-10-12T11:00:00Z');
  });
});
