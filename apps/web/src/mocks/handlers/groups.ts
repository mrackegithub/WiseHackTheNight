import { DateTime } from 'luxon';
import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { locationById } from '../data/locations';
import { ALWAYS_TAKEN, roomById } from '../data/rooms';
import { db, nextId, type MockUser } from '../db';
import { busyMember } from '../sessions';
import { suggestedLocations } from '../group-locations';
import { suggestedSlots } from '../group-slots';
import { subjectById } from '../data/subjects';
import { isMember, publicUser, toGroup, toGroupSummary, type MockGroup } from '../groups';
import { apiError, authed, url } from '../utils';

const activeBooking = (b: Schemas['Booking']) => b.status === 'CONFIRMED' || b.status === 'PENDING';
const overlapsBooking = (b: { start: string; end: string }, start: string, end: string) => Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start);
const isRoomFree = (roomId: string, start: string, end: string) => ![...db.bookings.values()].some((b) => b.room.id === roomId && activeBooking(b) && overlapsBooking(b, start, end));

/** Members see any of their groups; others only open ones (as in the candidate deck). */
function visibleGroup(user: MockUser, groupId: unknown) {
  const group = db.groups.get(String(groupId));
  return group && (isMember(group, user.me.id) || group.isOpen) ? group : null;
}

const notFound = () => apiError(404, 'NOT_FOUND', 'Group not found');

export const groupHandlers = [
  http.get(
    url('/groups'),
    authed((user) =>
      HttpResponse.json<Schemas['GroupSummary'][]>(
        [...db.groups.values()]
          .filter((g) => isMember(g, user.me.id))
          .map(toGroupSummary)
          // soonest next session first, then groups without one
          .sort((a, b) => (a.nextSessionAt ?? '9999').localeCompare(b.nextSessionAt ?? '9999') || a.name.localeCompare(b.name)),
      ),
    ),
  ),

  http.get(
    url('/groups/:groupId'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      return group ? HttpResponse.json<Schemas['Group']>(toGroup(group)) : notFound();
    }),
  ),

  http.post(
    url('/groups/:groupId/members'),
    authed((user, { params }) => {
      const group = db.groups.get(String(params.groupId));
      if (!group) return notFound();
      if (isMember(group, user.me.id)) return HttpResponse.json<Schemas['Group']>(toGroup(group));
      if (!group.isOpen) return apiError(403, 'GROUP_CLOSED', 'This group is invite-only');
      if (group.members.length >= group.maxSize) return apiError(409, 'GROUP_FULL', 'Group is full');
      const role = user.subjects.find((s) => s.subject.id === group.subjectId)?.role ?? 'PEER';
      group.members.push({ userId: user.me.id, role, isOwner: false, joinedAt: new Date().toISOString() });
      return HttpResponse.json<Schemas['Group']>(toGroup(group));
    }),
  ),

  http.delete(
    url('/groups/:groupId/members'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group || !isMember(group, user.me.id)) return notFound();
      const wasOwner = group.members.find((m) => m.userId === user.me.id)?.isOwner;
      group.members = group.members.filter((m) => m.userId !== user.me.id);
      if (group.members.length === 0) db.groups.delete(group.id);
      else if (wasOwner) group.members[0].isOwner = true; // ownership passes on
      return new HttpResponse(null, { status: 204 });
    }),
  ),

  http.get(
    url('/groups/:groupId/suggested-slots'),
    authed((user, { params, request }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group) return notFound();
      const q = new URL(request.url).searchParams;
      const from = DateTime.fromISO(q.get('from') ?? '');
      const to = DateTime.fromISO(q.get('to') ?? '');
      const minMinutes = Math.max(30, Number(q.get('minMinutes') ?? 60) || 60);
      if (!from.isValid || !to.isValid || to <= from || to.diff(from, 'days').days > 31) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid range', [{ path: 'to', issue: 'from < to, max 31 days' }]);
      }
      return HttpResponse.json<Schemas['SuggestedSlot'][]>(suggestedSlots(group, from, to, minMinutes));
    }),
  ),

  http.get(
    url('/groups/:groupId/suggested-locations'),
    authed((user, { params, request }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group) return notFound();
      const q = new URL(request.url).searchParams;
      const type = q.get('type') as Schemas['LocationType'] | null;
      if (type && !['LIBRARY', 'CAMPUS_ROOM', 'CAFE', 'COWORKING', 'OTHER'].includes(type)) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid type', [{ path: 'type', issue: 'unknown location type' }]);
      }
      const limit = Math.min(Math.max(Number(q.get('limit') ?? 5) || 5, 1), 20);
      return HttpResponse.json<Schemas['SuggestedLocation'][]>(suggestedLocations(group, user.me.id, type, limit));
    }),
  ),

  http.get(
    url('/groups/:groupId/sessions'),
    authed((user, { params }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group) return notFound();
      const sessions = group.sessions.map((s) => {
        if (!s.room && s.bookingId) {
          const booking = db.bookings.get(s.bookingId);
          if (booking) {
            return {
              ...s,
              room: {
                id: booking.room.id,
                name: booking.room.name,
                locationName: locationById(booking.room.locationId)?.name ?? null,
                status: booking.status,
              },
            };
          }
        }
        return s;
      });
      return HttpResponse.json<Schemas['StudySession'][]>([...sessions].sort((a, b) => a.start.localeCompare(b.start)));
    }),
  ),

  http.post(
    url('/groups/:groupId/sessions'),
    authed(async (user, { params, request }) => {
      const group = visibleGroup(user, params.groupId);
      if (!group || !isMember(group, user.me.id)) return notFound();
      const body = (await request.json()) as Schemas['CreateSessionRequest'];

      const start = Date.parse(body.start);
      const end = Date.parse(body.end);
      if (!(start < end) || end - start > 8 * 3_600_000) return apiError(422, 'VALIDATION_FAILED', 'Invalid time', [{ path: 'end', issue: 'end after start, at most 8 h' }]);
      if (body.onlineUrl && !/^https?:\/\/\S+$/.test(body.onlineUrl)) return apiError(422, 'VALIDATION_FAILED', 'Invalid link', [{ path: 'onlineUrl', issue: 'must be a URL' }]);
      const location = body.locationId ? locationById(body.locationId) : null;
      if (body.locationId && !location) return apiError(422, 'VALIDATION_FAILED', 'Unknown location', [{ path: 'locationId', issue: 'unknown location' }]);

      let booking: Schemas['Booking'] | null = null;
      let createdBooking = false;
      if (body.roomId && !body.bookingId) {
        const room = roomById(body.roomId);
        if (!room) return apiError(404, 'NOT_FOUND', 'Room not found');
        if (room.name === ALWAYS_TAKEN || !isRoomFree(room.id, body.start, body.end)) {
          return apiError(409, 'SLOT_TAKEN', 'Room already booked for that time');
        }
        booking = {
          id: nextId(),
          room,
          groupId: group.id,
          start: body.start,
          end: body.end,
          status: 'CONFIRMED',
          externalRef: `MOCK-${db.bookings.size + 1}`,
        };
        db.bookings.set(booking.id, booking);
        createdBooking = true;
      } else if (body.bookingId) {
        booking = db.bookings.get(body.bookingId) ?? null;
        if (!booking || booking.groupId !== group.id || booking.status === 'CANCELLED') {
          return apiError(422, 'VALIDATION_FAILED', 'Invalid booking', [{ path: 'bookingId', issue: 'must be an active booking of this group' }]);
        }
      }

      const busy = busyMember(group, body.start, body.end);
      if (busy) {
        if (createdBooking && booking) {
          db.bookings.delete(booking.id);
        }
        return apiError(409, 'CONFLICT', `${busy} is busy at that time`);
      }

      const loc = location ?? (booking ? locationById(booking.room.locationId) : null);
      const roomSummary = booking
        ? {
            id: booking.room.id,
            name: booking.room.name,
            locationName: locationById(booking.room.locationId)?.name ?? null,
            status: booking.status,
          }
        : null;

      const session: Schemas['StudySession'] = {
        id: nextId(),
        groupId: group.id,
        start: new Date(start).toISOString().replace('.000', ''),
        end: new Date(end).toISOString().replace('.000', ''),
        location: loc ?? null,
        onlineUrl: body.onlineUrl ?? null,
        bookingId: booking ? booking.id : null,
        status: 'PLANNED',
        room: roomSummary,
      };
      group.sessions.push(session);
      return HttpResponse.json<Schemas['StudySession']>(session, { status: 201 });
    }),
  ),

  http.post(
    url('/groups'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['CreateGroupRequest'];
      const name = body.name?.trim() ?? '';
      const details: { path: string; issue: string }[] = [];
      if (name.length < 3 || name.length > 60) details.push({ path: 'name', issue: '3–60 characters' });
      if (!subjectById(body.subjectId)) details.push({ path: 'subjectId', issue: 'unknown subject' });
      if (!Number.isInteger(body.maxSize) || body.maxSize < 2 || body.maxSize > 10) details.push({ path: 'maxSize', issue: '2–10' });
      if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Request validation failed', details);
      const role = user.subjects.find((s) => s.subject.id === body.subjectId)?.role ?? 'PEER';
      const group: MockGroup = {
        id: nextId(),
        name,
        description: body.description?.trim() || null,
        subjectId: body.subjectId,
        maxSize: body.maxSize,
        isOpen: body.isOpen ?? true,
        members: [{ userId: user.me.id, role, isOwner: true, joinedAt: new Date().toISOString() }],
        sessions: [],
      };
      db.groups.set(group.id, group);
      return HttpResponse.json<Schemas['Group']>(toGroup(group), { status: 201 });
    }),
  ),

  http.post(
    url('/groups/:groupId/invites'),
    authed((user, { params }) => {
      const group = db.groups.get(String(params.groupId));
      if (!group) return notFound();
      if (!isMember(group, user.me.id)) return apiError(403, 'FORBIDDEN', 'Only members can invite people');
      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
      db.invites.set(token, { groupId: group.id, createdById: user.me.id, expiresAt });
      return HttpResponse.json<Schemas['GroupInvite']>({ token, groupId: group.id, expiresAt }, { status: 201 });
    }),
  ),

  http.get(
    url('/invites/:token'),
    authed((user, { params }) => {
      const found = validInvite(params.token);
      if ('error' in found) return found.error;
      const { invite, group } = found;
      return HttpResponse.json<Schemas['InvitePreview']>({
        token: String(params.token),
        expiresAt: invite.expiresAt,
        invitedBy: publicUser(invite.createdById),
        group: toGroup(group),
        alreadyMember: isMember(group, user.me.id),
      });
    }),
  ),

  http.post(
    url('/invites/:token/accept'),
    authed((user, { params }) => {
      const found = validInvite(params.token);
      if ('error' in found) return found.error;
      const { group } = found;
      if (!isMember(group, user.me.id)) {
        if (group.members.length >= group.maxSize) return apiError(409, 'GROUP_FULL', 'Group is full');
        const role = user.subjects.find((s) => s.subject.id === group.subjectId)?.role ?? 'PEER';
        group.members.push({ userId: user.me.id, role, isOwner: false, joinedAt: new Date().toISOString() });
      }
      return HttpResponse.json<Schemas['Group']>(toGroup(group));
    }),
  ),
];

/** The invite and its group, or the contract's 404 / 410 INVITE_EXPIRED. */
function validInvite(token: unknown) {
  const invite = db.invites.get(String(token));
  const group = invite && db.groups.get(invite.groupId);
  if (!invite || !group) return { error: apiError(404, 'NOT_FOUND', 'Invite not found') };
  if (Date.parse(invite.expiresAt) < Date.now()) return { error: apiError(410, 'INVITE_EXPIRED', 'This invite link has expired') };
  return { invite, group };
}
