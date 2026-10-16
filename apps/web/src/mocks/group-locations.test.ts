import { describe, expect, it } from 'vitest';
import { db, DEMO_USER_ID } from './db';
import { suggestedLocations } from './group-locations';

const crew = () => db.groups.get('00000000-0000-4000-8005-000000000004')!;

describe('mock suggested locations', () => {
  it('ranks by the longest member trip (fairness), roughly ascending', () => {
    const list = suggestedLocations(crew(), DEMO_USER_ID, null, 20);
    expect(list.length).toBeGreaterThan(5);
    // preferred-type / bookable nudges are ≤ 0.5 km, so max distance is non-decreasing within that tolerance
    for (let i = 1; i < list.length; i++) expect(list[i].maxMemberDistanceKm).toBeGreaterThanOrEqual(list[i - 1].maxMemberDistanceKm - 0.5);
    for (const s of list) {
      expect(s.avgMemberDistanceKm).toBeLessThanOrEqual(s.maxMemberDistanceKm);
      expect(s.location.distanceKm!).toBeLessThanOrEqual(3); // within 3 km of the centroid
    }
  });

  it('filters by type and limits the result', () => {
    expect(suggestedLocations(crew(), DEMO_USER_ID, 'LIBRARY', 2).map((s) => s.location.type)).toEqual(['LIBRARY', 'LIBRARY']);
  });

  it('only returns contract fields (no member home coordinates)', () => {
    const [first] = suggestedLocations(crew(), DEMO_USER_ID, null, 1);
    expect(Object.keys(first).sort()).toEqual(['avgMemberDistanceKm', 'location', 'maxMemberDistanceKm']);
  });
});
