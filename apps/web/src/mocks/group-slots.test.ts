import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZONE } from '../lib/time';
import { db } from './db';
import { suggestedSlots } from './group-slots';

const crew = () => db.groups.get('00000000-0000-4000-8005-000000000004')!;

describe('mock suggested slots', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  const from = DateTime.fromISO('2026-10-14T13:00', { zone: ZONE });
  const to = from.plus({ days: 7 });

  it('ranks best first and only lists members of the group', () => {
    const slots = suggestedSlots(crew(), from, to, 60);
    expect(slots.length).toBeGreaterThan(3);
    expect(slots.map((s) => s.score)).toEqual([...slots.map((s) => s.score)].sort((a, b) => b - a));
    const memberIds = crew().members.map((m) => m.userId);
    for (const s of slots) {
      expect(s.availableMemberIds.every((id) => memberIds.includes(id))).toBe(true);
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it('respects minMinutes', () => {
    for (const s of suggestedSlots(crew(), from, to, 120)) {
      expect(Date.parse(s.end) - Date.parse(s.start)).toBeGreaterThanOrEqual(120 * 60_000);
    }
  });
});
