import { describe, expect, it } from 'vitest';
import { readCachedWindows, validateWindows, writeCachedWindows } from './windows';

describe('validateWindows', () => {
  it('accepts separate ranges on the same day', () => {
    expect(
      validateWindows([
        { weekday: 1, startTime: '08:00', endTime: '12:00' },
        { weekday: 1, startTime: '13:00', endTime: '18:00' },
      ]),
    ).toEqual({});
  });

  it('reports start ≥ end, overlaps and bad formats per weekday', () => {
    expect(
      validateWindows([
        { weekday: 1, startTime: '12:00', endTime: '09:00' },
        { weekday: 2, startTime: '08:00', endTime: '12:00' },
        { weekday: 2, startTime: '11:00', endTime: '14:00' },
        { weekday: 3, startTime: '8:00', endTime: '12:00' },
      ]),
    ).toEqual({
      1: 'Each range must end after it starts.',
      2: 'Ranges on the same day must not overlap.',
      3: 'Enter times as HH:mm.',
    });
  });
});

describe('cached windows (stopgap)', () => {
  it('is stored per user', () => {
    writeCachedWindows('u1', [{ weekday: 6, startTime: '10:00', endTime: '14:00' }]);
    expect(readCachedWindows('u1')).toEqual([{ weekday: 6, startTime: '10:00', endTime: '14:00' }]);
    expect(readCachedWindows('u2')).toBeNull();
  });
});
