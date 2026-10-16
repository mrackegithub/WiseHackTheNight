import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';

describe('C4: Neptun Calendar Integration Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  const validIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//HU
BEGIN:VEVENT
UID:neptun-upload-101@test
DTSTART:20261020T080000Z
DTEND:20261020T100000Z
SUMMARY:Algorithms and Data Structures I (IP-18AA1E)
LOCATION:IB 028
END:VEVENT
END:VCALENDAR`;

  beforeAll(async () => {
    app = await buildApp();

    // Ensure subject IP-18AA1E exists
    await app.prisma.subject.upsert({
      where: { code: 'IP-18AA1E' },
      update: {},
      create: { code: 'IP-18AA1E', name: 'Algorithms and Data Structures I', credits: 5 },
    });

    const email = `test-neptun-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Neptun User' },
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

  describe('GET /api/v1/integrations/neptun', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/neptun',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns NOT_CONNECTED initially', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.connected).toBe(false);
      expect(body.status).toBe('NOT_CONNECTED');
      expect(body.eventCount).toBe(0);
    });
  });

  describe('PUT /api/v1/integrations/neptun (connect)', () => {
    it('blocks private SSRF URL with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { icsUrl: 'http://127.0.0.1:4000/calendar.ics' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects empty or missing icsUrl with 422', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { icsUrl: '' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('POST /api/v1/integrations/neptun/upload', () => {
    it('rejects invalid non-ICS content with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/neptun/upload',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'text/calendar',
        },
        payload: 'NOT A VALID ICS',
      });

      expect(res.statusCode).toBe(400);
    });

    it('imports ICS, creates calendar events, and links subject as PEER', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/neptun/upload',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'text/calendar',
        },
        payload: validIcs,
      });

      expect(res.statusCode).toBe(200);
      const syncResult = res.json();
      expect(syncResult.imported).toBe(1);
      expect(syncResult.subjectsLinked).toBe(1);
      expect(syncResult.syncedAt).toBeDefined();

      // Verify event was saved
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(statusRes.json().status).toBe('OK');
      expect(statusRes.json().eventCount).toBe(1);

      // Verify user subject was created as PEER
      const subject = await app.prisma.subject.findUnique({
        where: { code: 'IP-18AA1E' },
      });
      const userSubject = await app.prisma.userSubject.findUnique({
        where: {
          userId_subjectId: {
            userId: testUserId,
            subjectId: subject!.id,
          },
        },
      });
      expect(userSubject).toBeDefined();
      expect(userSubject?.role).toBe('PEER');
    });

    it('re-uploading is idempotent and does not duplicate events', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/neptun/upload',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'text/calendar',
        },
        payload: validIcs,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().imported).toBe(1);
      expect(res.json().subjectsLinked).toBe(0); // Already linked

      const count = await app.prisma.calendarEvent.count({
        where: { userId: testUserId, source: 'NEPTUN' },
      });
      expect(count).toBe(1);
    });
  });

  describe('POST /api/v1/integrations/neptun/sync', () => {
    it('returns 409 when user has no stored encrypted URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/integrations/neptun/sync',
        headers: { authorization: `Bearer ${authToken}` },
      });

      // User uploaded file directly, so icsUrlEncrypted is null -> 409
      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/v1/integrations/neptun (disconnect)', () => {
    it('disconnects and clears imported calendar events', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify connection status reset
      const statusRes = await app.inject({
        method: 'GET',
        url: '/api/v1/integrations/neptun',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(statusRes.json().status).toBe('NOT_CONNECTED');
      expect(statusRes.json().eventCount).toBe(0);
    });
  });

  describe('Calendar schedule & availability routes', () => {
    it('GET /api/v1/me/schedule returns 200 with empty list when no events exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/me/schedule?from=2026-10-19T00:00:00Z&to=2026-10-25T23:59:59Z',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it('PUT and GET /api/v1/me/availability handles custom weekly windows', async () => {
      const windows = [{ weekday: 1, startTime: '09:00', endTime: '15:00' }];

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/me/availability',
        headers: { authorization: `Bearer ${authToken}` },
        payload: windows,
      });
      expect(putRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/me/availability?from=2026-10-19T00:00:00Z&to=2026-10-19T23:59:59Z',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().length).toBeGreaterThan(0);
    });
  });
});
