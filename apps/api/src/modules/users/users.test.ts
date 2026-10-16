import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B3: Users Profile Module', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let authToken: string;
  let testSubjectId: string;
  let testInterestId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Create test interest with unique slug
    const interestSlug = `user-profile-int-${Date.now()}`;
    const interest = await app.prisma.interest.create({
      data: { slug: interestSlug, label: 'Test Interest User' },
    });
    testInterestId = interest.id;

    // Create test subject
    const subject = await app.prisma.subject.upsert({
      where: { code: 'TEST-101' },
      update: {},
      create: { code: 'TEST-101', name: 'Intro to Testing', credits: 5 },
    });
    testSubjectId = subject.id;

    // Register a test user
    const email = `test-profile-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Profile User' },
    });
    const data = regRes.json();
    authToken = data.accessToken;
    const decoded = app.jwt.decode<{ sub: string }>(authToken);
    testUserId = decoded!.sub;
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({
      where: { email: { contains: 'test-profile-' } },
    });
    if (testInterestId) {
      await app.prisma.interest.deleteMany({
        where: { id: testInterestId },
      });
    }
    await app.close();
  });

  describe('GET & PATCH /api/v1/me', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
      expect(res.statusCode).toBe(401);
    });

    it('returns full profile for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.id).toBe(testUserId);
      expect(json.displayName).toBe('Profile User');
      expect(json.interests).toBeInstanceOf(Array);
      expect(json.onboardingComplete).toBe(false);
      expect(json.location).toBeNull();
    });

    it('updates profile and links interests with PATCH /api/v1/me', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          displayName: 'Updated Name',
          bio: 'CS Student at BME',
          university: 'BME',
          faculty: 'VIK',
          interestIds: [testInterestId],
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.displayName).toBe('Updated Name');
      expect(json.bio).toBe('CS Student at BME');
      expect(json.university).toBe('BME');
      expect(json.faculty).toBe('VIK');
      expect(json.interests).toHaveLength(1);
      expect(json.interests[0].id).toBe(testInterestId);
    });
  });

  describe('GET & PUT /api/v1/me/subjects', () => {
    it('returns empty subject list initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/subjects',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('replaces subjects with PUT /api/v1/me/subjects', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/subjects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: [
          {
            subjectId: testSubjectId,
            role: 'CAN_EXPLAIN',
            confidence: 5,
          },
        ],
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveLength(1);
      expect(json[0].subject.id).toBe(testSubjectId);
      expect(json[0].role).toBe('CAN_EXPLAIN');
      expect(json[0].confidence).toBe(5);
    });

    it('rejects nonexistent subject ID with 422', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/subjects',
        headers: { authorization: `Bearer ${authToken}` },
        payload: [
          {
            subjectId: '00000000-0000-0000-0000-000000000000',
            role: 'PEER',
            confidence: 3,
          },
        ],
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET & PUT /api/v1/me/preferences', () => {
    it('returns default preferences', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/preferences',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.groupSizeMin).toBe(2);
      expect(json.groupSizeMax).toBe(4);
      expect(json.maxDistanceKm).toBe(5);
      expect(json.sessionLengthMinutes).toBe(90);
      expect(json.mode).toBe('EITHER');
    });

    it('updates preferences with valid input', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/preferences',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          groupSizeMin: 3,
          groupSizeMax: 6,
          maxDistanceKm: 10,
          sessionLengthMinutes: 120,
          locationTypes: ['LIBRARY', 'CAFE'],
          mode: 'IN_PERSON',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.groupSizeMin).toBe(3);
      expect(json.groupSizeMax).toBe(6);
      expect(json.maxDistanceKm).toBe(10);
      expect(json.sessionLengthMinutes).toBe(120);
      expect(json.locationTypes).toEqual(['LIBRARY', 'CAFE']);
      expect(json.mode).toBe('IN_PERSON');
    });

    it('rejects groupSizeMax < groupSizeMin with 422', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/preferences',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          groupSizeMin: 5,
          groupSizeMax: 3,
          maxDistanceKm: 10,
          sessionLengthMinutes: 60,
          locationTypes: [],
          mode: 'ONLINE',
        },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VALIDATION_FAILED');
    });
  });

  describe('PUT /api/v1/me/location (rounding coordinates)', () => {
    it('rounds coordinates to 3 decimal places (~100m) and returns GeoPoint', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/location',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          lat: 47.49791234,
          lng: 19.04023456,
          label: 'Near BME Campus',
        },
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.lat).toBe(47.498);
      expect(json.lng).toBe(19.04);
      expect(json.label).toBe('Near BME Campus');

      // Verify rounded coordinates in GET /me
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(meRes.json().location).toEqual({
        lat: 47.498,
        lng: 19.04,
        label: 'Near BME Campus',
      });
    });
  });
});
