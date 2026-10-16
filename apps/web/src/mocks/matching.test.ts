import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { people } from './data/people';
import { subjects } from './data/subjects';
import { db, DEMO_USER_ID, type MockUser } from './db';
import { buildCandidates, roleComplement } from './matching';

const ALGO = subjects[0].id;
const DB = subjects[8].id;
const demo = (): MockUser => db.users.get(DEMO_USER_ID)!;

describe('mock matching engine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('uses the role complement table from ARCHITECTURE §4.2', () => {
    expect(roleComplement('NEEDS_HELP', 'CAN_EXPLAIN')).toBe(1);
    expect(roleComplement('PEER', 'PEER')).toBe(0.7);
    expect(roleComplement('PEER', 'NEEDS_HELP')).toBe(0.5);
    expect(roleComplement('NEEDS_HELP', 'NEEDS_HELP')).toBe(0.3);
    expect(roleComplement('CAN_EXPLAIN', 'CAN_EXPLAIN')).toBe(0.4);
  });

  it('ranks people best first, with components in [0,1] and total = weighted sum × 100', () => {
    const list = buildCandidates(demo(), ALGO, 'user', 30);
    expect(list.length).toBeGreaterThan(3);
    expect(list.map((c) => c.score.total)).toEqual([...list.map((c) => c.score.total)].sort((a, b) => b - a));
    for (const { score: s } of list) {
      for (const v of [s.timeOverlap, s.roleComplement, s.interests, s.proximity, s.groupSizeFit]) expect(v).toBeGreaterThanOrEqual(0);
      const total = 100 * (0.35 * s.timeOverlap + 0.25 * s.roleComplement + 0.15 * s.interests + 0.15 * s.proximity + 0.1 * s.groupSizeFit);
      expect(s.total).toBeCloseTo(total, 0);
    }
  });

  it('excludes recently swiped people, people already in a group with me, and anyone beyond my max distance', () => {
    const swiped = buildCandidates(demo(), DB, 'user', 30)[0].id;
    demo().swipes.push({ targetKind: 'user', targetId: swiped, subjectId: DB, direction: 'PASS', at: new Date().toISOString() });

    const ids = buildCandidates(demo(), DB, 'user', 30).map((c) => c.id);
    expect(ids).not.toContain(swiped);
    expect(ids).not.toContain(people[11].user.id); // Levente: in "DB Thursday crew" with the demo user
    for (const c of buildCandidates(demo(), ALGO, 'user', 30)) expect(c.distanceKm!).toBeLessThanOrEqual(4); // demo: IN_PERSON, 4 km
  });

  it('offers only open groups with space that I am not in', () => {
    expect(buildCandidates(demo(), ALGO, 'group', 10).map((c) => c.group?.name)).toEqual(['Algo Night Owls']);
    expect(buildCandidates(demo(), DB, 'group', 10)).toEqual([]); // SQL Squad is full, DB Thursday crew is mine
  });
});
