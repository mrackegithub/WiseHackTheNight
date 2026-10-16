import type { Schemas } from '@sgm/contracts';
import { locations } from './data/locations';
import { personById } from './data/people';
import { db, defaultPreferences } from './db';
import type { MockGroup } from './groups';
import { haversineKm } from './matching';

const RADIUS_KM = 3;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Members' home points; these never leave the mock (only distances do). */
function homes(group: MockGroup) {
  return group.members
    .map((m) => personById(m.userId)?.location ?? db.users.get(m.userId)?.me.location ?? null)
    .filter((p): p is { lat: number; lng: number } => p !== null && p !== undefined);
}

/**
 * Mock of getGroupSuggestedLocations (ARCHITECTURE §4.3): centroid of members' homes → places within 3 km
 * → ranked by the max member distance (fairness), then the viewer's preferred place types, bookable bonus.
 */
export function suggestedLocations(group: MockGroup, viewerId: string, type: Schemas['LocationType'] | null, limit: number): Schemas['SuggestedLocation'][] {
  const points = homes(group);
  if (points.length === 0) return [];
  const centroid = { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
  const preferred = new Set((db.users.get(viewerId)?.preferences ?? defaultPreferences()).locationTypes);

  return locations
    .filter((l) => (!type || l.type === type) && haversineKm(centroid, l.point) <= RADIUS_KM)
    .map((l) => {
      const distances = points.map((p) => haversineKm(p, l.point));
      const max = Math.max(...distances);
      const avg = distances.reduce((s, d) => s + d, 0) / distances.length;
      // lower is better: fairness first, small nudges for preferred type and bookable rooms
      const rank = max - (preferred.has(l.type) ? 0.3 : 0) - (l.bookable ? 0.2 : 0);
      return { rank, suggestion: { location: { ...l, distanceKm: round1(haversineKm(centroid, l.point)) }, maxMemberDistanceKm: round1(max), avgMemberDistanceKm: round1(avg) } };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.suggestion);
}
