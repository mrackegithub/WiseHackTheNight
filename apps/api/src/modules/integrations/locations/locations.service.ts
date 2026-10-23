import type { PrismaClient } from '@prisma/client';
import { geocoder, geoService } from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import { HttpError, notFound } from '../../../core/errors.js';
import type {
  GeocodeQuery,
  ListLocationsQuery,
  SuggestedLocationsQuery,
} from './locations.schemas.js';

export type LocationDto =
  paths['/locations']['get']['responses'][200]['content']['application/json'][number];
export type SuggestedLocationDto =
  paths['/groups/{groupId}/suggested-locations']['get']['responses'][200]['content']['application/json'][number];
export type GeoPointDto =
  paths['/locations/geocode']['get']['responses'][200]['content']['application/json'][number];

const BUDAPEST_CENTER = { lat: 47.4979, lng: 19.0402 };

export async function listLocations(
  prisma: PrismaClient,
  query: ListLocationsQuery,
): Promise<LocationDto[]> {
  const whereClause: { type?: ListLocationsQuery['type'] } = {};
  if (query.type) {
    whereClause.type = query.type;
  }

  const locations = await prisma.location.findMany({
    where: whereClause,
    include: {
      rooms: { select: { id: true } },
    },
  });

  const hasCoords = query.lat !== undefined && query.lng !== undefined;
  const userPoint = hasCoords ? { lat: query.lat!, lng: query.lng! } : null;

  const mapped = locations.map((loc) => {
    const distanceKm = userPoint
      ? geoService.distanceKm(userPoint, { lat: loc.lat, lng: loc.lng })
      : null;

    return {
      id: loc.id,
      name: loc.name,
      type: loc.type,
      address: loc.address,
      point: {
        lat: loc.lat,
        lng: loc.lng,
        label: loc.name,
      },
      bookable: loc.rooms.length > 0,
      openingHours: loc.openingHours,
      distanceKm,
    };
  });

  if (hasCoords) {
    const radius = query.radiusKm ?? 3;
    return mapped
      .filter((loc) => loc.distanceKm !== null && loc.distanceKm <= radius)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  return mapped;
}

export async function geocodeAddress(
  query: GeocodeQuery,
  fetcher?: typeof fetch,
): Promise<GeoPointDto[]> {
  let results;
  try {
    results = await geocoder.geocode(query.q, { fetcher });
  } catch (err) {
    // the provider is down, blocked us or rate-limited us: a 502, not an unexpected 500
    throw new HttpError(502, 'GEOCODER_UNAVAILABLE', `Address search is unavailable: ${err instanceof Error ? err.message : String(err)}`);
  }
  return results.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    label: r.label.slice(0, 120),
  }));
}

export async function getGroupSuggestedLocations(
  prisma: PrismaClient,
  groupId: string,
  query: SuggestedLocationsQuery,
): Promise<SuggestedLocationDto[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: {
          user: {
            select: {
              homeLat: true,
              homeLng: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }

  const memberPoints = group.members
    .filter((m) => m.user.homeLat !== null && m.user.homeLng !== null)
    .map((m) => ({ lat: m.user.homeLat!, lng: m.user.homeLng! }));

  const activePoints = memberPoints.length > 0 ? memberPoints : [BUDAPEST_CENTER];
  const centroid = geoService.centroid(activePoints);

  const whereClause: { type?: SuggestedLocationsQuery['type'] } = {};
  if (query.type) {
    whereClause.type = query.type;
  }

  const allLocations = await prisma.location.findMany({
    where: whereClause,
    include: {
      rooms: { select: { id: true } },
    },
  });

  if (allLocations.length === 0) {
    return [];
  }

  // Filter to within 3 km of centroid (fallback to 10 km if none match)
  let candidates = allLocations.filter(
    (loc) => geoService.distanceKm(centroid, { lat: loc.lat, lng: loc.lng }) <= 3,
  );
  if (candidates.length === 0) {
    candidates = allLocations.filter(
      (loc) => geoService.distanceKm(centroid, { lat: loc.lat, lng: loc.lng }) <= 10,
    );
  }
  if (candidates.length === 0) {
    candidates = allLocations;
  }

  const scored = candidates.map((loc) => {
    const locCoord = { lat: loc.lat, lng: loc.lng };
    const distToCentroid = geoService.distanceKm(centroid, locCoord);

    const distances = activePoints.map((p) => geoService.distanceKm(p, locCoord));
    const maxMemberDistanceKm = Math.max(...distances);
    const avgMemberDistanceKm =
      Math.round((distances.reduce((sum, d) => sum + d, 0) / distances.length) * 100) / 100;

    // Bookable libraries get a preference bonus (subtract 0.4 km from effective fairness rank)
    const libraryBonus = loc.type === 'LIBRARY' && loc.rooms.length > 0 ? 0.4 : 0;
    const rankingScore = maxMemberDistanceKm - libraryBonus;

    const locationDto: LocationDto = {
      id: loc.id,
      name: loc.name,
      type: loc.type,
      address: loc.address,
      point: {
        lat: loc.lat,
        lng: loc.lng,
        label: loc.name,
      },
      bookable: loc.rooms.length > 0,
      openingHours: loc.openingHours,
      distanceKm: distToCentroid,
    };

    return {
      location: locationDto,
      maxMemberDistanceKm,
      avgMemberDistanceKm,
      rankingScore,
    };
  });

  scored.sort((a, b) => a.rankingScore - b.rankingScore);

  const limit = query.limit ?? 5;
  return scored.slice(0, limit).map(({ location, maxMemberDistanceKm, avgMemberDistanceKm }) => ({
    location,
    maxMemberDistanceKm,
    avgMemberDistanceKm,
  }));
}
