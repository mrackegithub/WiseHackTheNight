import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';

describe('C3: Neptun / Calendar Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildApp();

    const email = `test-calendar-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Calendar User' },
    });
    const data = regRes.json();
    authToken = data.accessToken;
    const decoded = app.jwt.decode<{ sub: string }>(authToken);
    testUserId = decoded!.sub;
  });

  afterAll(async () => {
    if (testUserId) {
      await app.prisma.user.deleteMany({
        where: { id: testUserId },
      });
    }
    await app.close();
  });

  describe('GET /api/v1/me/schedule', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-25T23:59:59Z',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 when from is after to', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/schedule?from=2026-10-25T00:00:00Z&to=2026-10-19T00:00:00Z',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 when date range exceeds 31 days', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/schedule?from=2026-10-01T00:00:00Z&to=2026-11-15T00:00:00Z',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns 200 with user calendar events', async () => {
      // Seed a busy event
      await app.prisma.calendarEvent.create({
        data: {
          userId: testUserId,
          title: 'Algorithms Lecture',
          start: new Date('2026-10-19T08:00:00Z'),
          end: new Date('2026-10-19T10:00:00Z'),
          room: 'IB 028',
          subjectCode: 'IP-18AA1E',
          source: 'NEPTUN',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-19T23:59:59Z',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1);
      expect(json[0].title).toBe('Algorithms Lecture');
      expect(json[0].room).toBe('IB 028');
      expect(json[0].subjectCode).toBe('IP-18AA1E');
      expect(json[0].source).toBe('NEPTUN');
    });
  });

  describe('PUT & GET /api/v1/me/availability', () => {
    it('returns 401 for availability without auth', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/availability?from=2026-10-19T00:00:00Z&to=2026-10-19T23:59:59Z',
      });
      expect(getRes.statusCode).toBe(401);

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/availability',
        payload: [],
      });
      expect(putRes.statusCode).toBe(401);
    });

    it('saves custom weekly windows via PUT', async () => {
      const windows = [
        { weekday: 1, startTime: '10:00', endTime: '16:00' }, // Monday 10:00-16:00
      ];

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/availability',
        headers: { authorization: `Bearer ${authToken}` },
        payload: windows,
      });

      expect(putRes.statusCode).toBe(200);
      expect(putRes.json()).toEqual(windows);
    });

    it('returns free slots calculated with custom windows minus busy events', async () => {
      // User has custom Monday window 10:00-16:00 local time (08:00-14:00 UTC in CEST).
      // Event was created earlier: 08:00-10:00 UTC.
      // Free slot should be 10:00-14:00 UTC (4 hours = 240m >= 30m).
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/availability?from=2026-10-19T00:00:00Z&to=2026-10-19T23:59:59Z',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const slots = res.json();
      expect(Array.isArray(slots)).toBe(true);
      expect(slots).toHaveLength(1);
      expect(slots[0].start).toBe('2026-10-19T10:00:00.000Z');
      expect(slots[0].end).toBe('2026-10-19T14:00:00.000Z');
    });

    it('rejects invalid weekly window schema with 422', async () => {
      const invalid = [
        { weekday: 8, startTime: '10:00', endTime: '12:00' }, // Invalid weekday > 7
      ];

      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/availability',
        headers: { authorization: `Bearer ${authToken}` },
        payload: invalid,
      });

      expect(res.statusCode).toBe(422);
    });
  });
});

