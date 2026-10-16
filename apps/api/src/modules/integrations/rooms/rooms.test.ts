import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';

describe('C6: Rooms and Booking Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  let otherAuthToken: string;
  let testGroupId: string;
  let testLocationId: string;
  let testRoomId: string;
  let createdBookingId: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register primary user
    const email = `test-rooms-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Booking User' },
    });
    authToken = regRes.json().accessToken;
    const decoded = app.jwt.decode<{ sub: string }>(authToken);
    testUserId = decoded!.sub;

    // Register another user (non-member)
    const otherEmail = `test-other-${Date.now()}@sgm.local`;
    const otherRegRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: otherEmail, password: 'password123', displayName: 'Other User' },
    });
    otherAuthToken = otherRegRes.json().accessToken;

    // Create test subject and group
    const subject = await app.prisma.subject.upsert({
      where: { code: 'ROOM-101' },
      update: {},
      create: { code: 'ROOM-101', name: 'Room Testing', credits: 3 },
    });

    const group = await app.prisma.group.create({
      data: {
        name: 'Room Study Group',
        subjectId: subject.id,
        maxSize: 4,
        members: {
          create: [{ userId: testUserId, role: 'PEER' }],
        },
      },
    });
    testGroupId = group.id;

    // Create test location and room
    const loc = await app.prisma.location.create({
      data: {
        name: 'ELTE Informatics Library',
        type: 'LIBRARY',
        address: '1117 Budapest, Pázmány Péter sétány 1/C',
        lat: 47.4728,
        lng: 19.0595,
        openingHours: 'Mo-Fr 08:00-18:00',
        rooms: {
          create: [
            {
              name: 'Glass Room 1',
              capacity: 4,
              equipment: ['projector', 'whiteboard'],
              provider: 'MOCK',
            },
          ],
        },
      },
      include: {
        rooms: true,
      },
    });
    testLocationId = loc.id;
    testRoomId = loc.rooms[0].id;
  });

  afterAll(async () => {
    if (testRoomId) {
      await app.prisma.booking.deleteMany({ where: { roomId: testRoomId } });
    }
    if (testGroupId) {
      await app.prisma.group.deleteMany({ where: { id: testGroupId } });
    }
    if (testLocationId) {
      await app.prisma.room.deleteMany({ where: { locationId: testLocationId } });
      await app.prisma.location.deleteMany({ where: { id: testLocationId } });
    }
    await app.prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-rooms-',
        },
      },
    });
    await app.prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-other-',
        },
      },
    });
    await app.close();
  });

  describe('GET /api/v1/rooms', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/rooms?start=2026-10-20T10:00:00Z&end=2026-10-20T12:00:00Z',
      });
      expect(res.statusCode).toBe(401);
    });

    it('validates query parameters (422 if end <= start)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/rooms?start=2026-10-20T12:00:00Z&end=2026-10-20T10:00:00Z',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('returns available rooms matching location and capacity', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/rooms?locationId=${testLocationId}&capacity=2&start=2026-10-20T10:00:00Z&end=2026-10-20T12:00:00Z`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const rooms = res.json();
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.some((r: { id: string }) => r.id === testRoomId)).toBe(true);
    });
  });

  describe('POST /api/v1/bookings', () => {
    const bookingStart = '2026-10-20T14:00:00Z';
    const bookingEnd = '2026-10-20T16:00:00Z';

    it('rejects booking by non-member with 403 FORBIDDEN', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: `Bearer ${otherAuthToken}` },
        payload: {
          roomId: testRoomId,
          groupId: testGroupId,
          start: bookingStart,
          end: bookingEnd,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('FORBIDDEN');
    });

    it('creates booking successfully with 201 status and externalRef', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          roomId: testRoomId,
          groupId: testGroupId,
          start: bookingStart,
          end: bookingEnd,
        },
      });

      expect(res.statusCode).toBe(201);
      const booking = res.json();
      expect(booking.id).toBeDefined();
      expect(booking.roomId).toBeUndefined(); // contract has room object
      expect(booking.room.id).toBe(testRoomId);
      expect(booking.groupId).toBe(testGroupId);
      expect(booking.status).toBe('CONFIRMED');
      expect(booking.externalRef).toBeDefined();

      createdBookingId = booking.id;
    });

    it('rejects conflicting overlapping booking with 409 SLOT_TAKEN', async () => {
      const overlapStart = '2026-10-20T15:00:00Z';
      const overlapEnd = '2026-10-20T17:00:00Z';

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          roomId: testRoomId,
          groupId: testGroupId,
          start: overlapStart,
          end: overlapEnd,
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SLOT_TAKEN');
    });

    it('excludes booked room from GET /rooms during booked slot', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/rooms?locationId=${testLocationId}&start=${bookingStart}&end=${bookingEnd}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const rooms = res.json();
      expect(rooms.some((r: { id: string }) => r.id === testRoomId)).toBe(false);
    });
  });

  describe('GET /api/v1/bookings/:bookingId', () => {
    it('returns booking details for valid ID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${createdBookingId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const booking = res.json();
      expect(booking.id).toBe(createdBookingId);
      expect(booking.room.id).toBe(testRoomId);
    });

    it('returns 404 for nonexistent booking ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/${nonExistentId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/bookings/:bookingId', () => {
    it('cancels booking with 204 status', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/bookings/${createdBookingId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify status in database
      const dbBooking = await app.prisma.booking.findUnique({
        where: { id: createdBookingId },
      });
      expect(dbBooking?.status).toBe('CANCELLED');
    });

    it('makes the room available again after cancellation', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/rooms?locationId=${testLocationId}&start=2026-10-20T14:00:00Z&end=2026-10-20T16:00:00Z`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const rooms = res.json();
      expect(rooms.some((r: { id: string }) => r.id === testRoomId)).toBe(true);
    });
  });
});

