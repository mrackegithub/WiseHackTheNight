import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';

describe('C5: Locations and Geocoding Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let testGroupId: string;
  let testLocationId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register test user with home coordinates in Budapest (near BME)
    const email = `test-loc-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Location User' },
    });
    authToken = regRes.json().accessToken;
    const decoded = app.jwt.decode<{ sub: string }>(authToken);
    testUserId = decoded!.sub;

    await app.prisma.user.update({
      where: { id: testUserId },
      data: {
        homeLat: 47.4733,
        homeLng: 19.0598,
        homeLabel: 'BME Campus',
      },
    });

    // Create a test subject and group
    const subject = await app.prisma.subject.upsert({
      where: { code: 'LOC-101' },
      update: {},
      create: { code: 'LOC-101', name: 'Location Testing', credits: 3 },
    });

    const group = await app.prisma.group.create({
      data: {
        name: 'Geo Pod',
        subjectId: subject.id,
        maxSize: 4,
        members: {
          create: [{ userId: testUserId, role: 'PEER' }],
        },
      },
    });
    testGroupId = group.id;

    // Seed test locations
    const loc = await app.prisma.location.create({
      data: {
        name: 'BME Central Library',
        type: 'LIBRARY',
        address: '1111 Budapest, Műegyetem rkp. 3.',
        lat: 47.4812,
        lng: 19.0558,
        openingHours: 'Mo-Fr 08:00-20:00',
        rooms: {
          create: [
            {
              name: 'Study Room A',
              capacity: 6,
              equipment: ['whiteboard'],
              provider: 'MOCK',
            },
          ],
        },
      },
    });
    testLocationId = loc.id;
  });

  afterAll(async () => {
    if (testGroupId) {
      await app.prisma.group.deleteMany({ where: { id: testGroupId } });
    }
    if (testUserId) {
      await app.prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (testLocationId) {
      await app.prisma.location.deleteMany({ where: { id: testLocationId } });
    }
    await app.close();
  });

  describe('GET /api/v1/locations', () => {
    it('returns list of locations matching schema', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/locations',
      });

      expect(res.statusCode).toBe(200);
      const locations = res.json();
      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);

      const library = locations.find((l: { id: string }) => l.id === testLocationId);
      expect(library).toBeDefined();
      expect(library.bookable).toBe(true);
      expect(library.point.lat).toBe(47.4812);
    });

    it('filters by location type', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/locations?type=LIBRARY',
      });

      expect(res.statusCode).toBe(200);
      const locations = res.json();
      for (const loc of locations) {
        expect(loc.type).toBe('LIBRARY');
      }
    });

    it('calculates distanceKm and filters by radius when lat/lng are provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/locations?lat=47.4733&lng=19.0598&radiusKm=2',
      });

      expect(res.statusCode).toBe(200);
      const locations = res.json();
      expect(locations.length).toBeGreaterThan(0);
      for (const loc of locations) {
        expect(loc.distanceKm).not.toBeNull();
        expect(loc.distanceKm).toBeLessThanOrEqual(2);
      }
      // Check sorted ascending
      for (let i = 1; i < locations.length; i++) {
        expect(locations[i].distanceKm).toBeGreaterThanOrEqual(locations[i - 1].distanceKm);
      }
    });
  });

  describe('GET /api/v1/locations/geocode', () => {
    it('rejects queries shorter than 3 characters with 422', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/locations/geocode?q=hi',
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /api/v1/groups/:groupId/suggested-locations', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/groups/${testGroupId}/suggested-locations`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for non-existent group', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/groups/00000000-0000-0000-0000-000000000000/suggested-locations',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns ranked locations near member centroid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/groups/${testGroupId}/suggested-locations?limit=5`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const suggestions = res.json();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      const first = suggestions[0];
      expect(first.location).toBeDefined();
      expect(first.maxMemberDistanceKm).toBeDefined();
      expect(first.avgMemberDistanceKm).toBeDefined();
      expect(typeof first.maxMemberDistanceKm).toBe('number');
    });
  });
});
