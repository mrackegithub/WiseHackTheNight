import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { ALWAYS_TAKEN, roomById, rooms } from '../data/rooms';
import { db, nextId } from '../db';
import { isMember } from '../groups';
import { apiError, authed, url } from '../utils';

const active = (b: Schemas['Booking']) => b.status === 'CONFIRMED' || b.status === 'PENDING';
const overlaps = (b: { start: string; end: string }, start: string, end: string) => Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start);
const isFree = (roomId: string, start: string, end: string) => ![...db.bookings.values()].some((b) => b.room.id === roomId && active(b) && overlaps(b, start, end));

export const roomHandlers = [
  http.get(
    url('/rooms'),
    authed((_user, { request }) => {
      const q = new URL(request.url).searchParams;
      const start = q.get('start') ?? '';
      const end = q.get('end') ?? '';
      if (!(Date.parse(start) < Date.parse(end))) return apiError(422, 'VALIDATION_FAILED', 'start/end required', [{ path: 'end', issue: 'end after start' }]);
      const locationId = q.get('locationId');
      const capacity = Number(q.get('capacity') ?? 1) || 1;
      return HttpResponse.json<Schemas['Room'][]>(
        rooms.filter((r) => (!locationId || r.locationId === locationId) && r.capacity >= capacity && isFree(r.id, start, end)),
      );
    }),
  ),

  http.post(
    url('/bookings'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['CreateBookingRequest'];
      const room = roomById(body.roomId);
      const group = db.groups.get(body.groupId);
      if (!room) return apiError(404, 'NOT_FOUND', 'Room not found');
      if (!group || !isMember(group, user.me.id)) return apiError(404, 'NOT_FOUND', 'Group not found');
      if (!(Date.parse(body.start) < Date.parse(body.end))) return apiError(422, 'VALIDATION_FAILED', 'Invalid time', [{ path: 'end', issue: 'end after start' }]);
      if (room.name === ALWAYS_TAKEN || !isFree(room.id, body.start, body.end)) return apiError(409, 'SLOT_TAKEN', 'Room already booked for that time');

      const booking: Schemas['Booking'] = { id: nextId(), room, groupId: group.id, start: body.start, end: body.end, status: 'CONFIRMED', externalRef: `MOCK-${db.bookings.size + 1}` };
      db.bookings.set(booking.id, booking);
      return HttpResponse.json<Schemas['Booking']>(booking, { status: 201 });
    }),
  ),

  http.get(
    url('/bookings/:bookingId'),
    authed((user, { params }) => {
      const booking = db.bookings.get(String(params.bookingId));
      const group = booking && db.groups.get(booking.groupId);
      if (!booking || !group || !isMember(group, user.me.id)) return apiError(404, 'NOT_FOUND', 'Booking not found');
      return HttpResponse.json<Schemas['Booking']>(booking);
    }),
  ),

  http.delete(
    url('/bookings/:bookingId'),
    authed((user, { params }) => {
      const booking = db.bookings.get(String(params.bookingId));
      const group = booking && db.groups.get(booking.groupId);
      if (!booking || !group || !isMember(group, user.me.id)) return apiError(404, 'NOT_FOUND', 'Booking not found');
      booking.status = 'CANCELLED';
      return new HttpResponse(null, { status: 204 });
    }),
  ),
];
