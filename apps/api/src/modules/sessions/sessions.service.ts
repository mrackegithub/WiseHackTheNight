import type { PrismaClient } from '@prisma/client';
import { conflict, forbidden, notFound, validationError } from '../../core/errors.js';
import { cancelBooking } from '../integrations/rooms/rooms.service.js';
import type { CreateSessionInput } from './sessions.schemas.js';

/** Cancels a session for the whole group: frees every member's calendar and releases its room booking. */
export async function cancelStudySession(prisma: PrismaClient, sessionId: string): Promise<void> {
  const session = await prisma.studySession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Session not found');
  await prisma.$transaction([
    prisma.studySession.update({ where: { id: sessionId }, data: { status: 'CANCELLED' } }),
    prisma.calendarEvent.deleteMany({ where: { source: 'STUDY_SESSION', externalUid: sessionId } }),
  ]);
  if (session.bookingId) await cancelBooking(prisma, session.bookingId);
}

export async function listGroupSessions(prisma: PrismaClient, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }

  const sessions = await prisma.studySession.findMany({
    where: { groupId },
    include: {
      location: {
        include: {
          rooms: { select: { id: true } },
        },
      },
    },
    orderBy: { start: 'asc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    location: s.location
      ? {
          id: s.location.id,
          name: s.location.name,
          type: s.location.type,
          address: s.location.address,
          point: { lat: s.location.lat, lng: s.location.lng },
          bookable: s.location.rooms.length > 0,
          openingHours: s.location.openingHours,
          distanceKm: null,
        }
      : null,
    onlineUrl: s.onlineUrl,
    bookingId: s.bookingId,
    status: s.status,
  }));
}

export async function createGroupSession(
  prisma: PrismaClient,
  userId: string,
  groupId: string,
  data: CreateSessionInput,
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { select: { userId: true } },
    },
  });
  if (!group) {
    throw notFound('Group not found', 'NOT_FOUND');
  }

  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw forbidden('You are not a member of this group', 'FORBIDDEN');
  }

  const start = new Date(data.start);
  const end = new Date(data.end);
  if (start.getTime() >= end.getTime()) {
    throw validationError('Start time must be before end time', [{ path: 'end', issue: 'must be after start' }]);
  }

  if (data.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
    });
    if (!booking) {
      throw notFound('Booking not found', 'NOT_FOUND');
    }
    if (booking.groupId !== groupId) {
      throw validationError('Booking does not belong to this group', [{ path: 'bookingId', issue: 'must be a booking of this group' }]);
    }
  }

  if (data.locationId) {
    const loc = await prisma.location.findUnique({
      where: { id: data.locationId },
    });
    if (!loc) {
      throw notFound('Location not found', 'NOT_FOUND');
    }
  }

  const memberIds = group.members.map((m) => m.userId);

  // Member conflict check (409)
  const conflictingSession = await prisma.studySession.findFirst({
    where: {
      status: { in: ['PLANNED', 'DONE'] },
      group: {
        members: {
          some: { userId: { in: memberIds } },
        },
      },
      start: { lt: end },
      end: { gt: start },
    },
  });
  if (conflictingSession) {
    throw conflict('A member is busy in that slot', 'MEMBER_BUSY');
  }

  const conflictingCalendarEvent = await prisma.calendarEvent.findFirst({
    where: {
      userId: { in: memberIds },
      start: { lt: end },
      end: { gt: start },
    },
  });
  if (conflictingCalendarEvent) {
    throw conflict('A member is busy in that slot', 'MEMBER_BUSY');
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.studySession.create({
      data: {
        groupId,
        start,
        end,
        locationId: data.locationId ?? null,
        onlineUrl: data.onlineUrl ?? null,
        bookingId: data.bookingId ?? null,
        status: 'PLANNED',
      },
      include: {
        location: {
          include: {
            rooms: { select: { id: true } },
          },
        },
      },
    });

    for (const mId of memberIds) {
      await tx.calendarEvent.upsert({
        where: {
          userId_source_externalUid: {
            userId: mId,
            source: 'STUDY_SESSION',
            externalUid: created.id,
          },
        },
        update: {
          start,
          end,
          title: `Study Session: ${group.name}`,
        },
        create: {
          userId: mId,
          source: 'STUDY_SESSION',
          externalUid: created.id,
          title: `Study Session: ${group.name}`,
          start,
          end,
        },
      });
    }

    return created;
  });

  return {
    id: session.id,
    groupId: session.groupId,
    start: session.start.toISOString(),
    end: session.end.toISOString(),
    location: session.location
      ? {
          id: session.location.id,
          name: session.location.name,
          type: session.location.type,
          address: session.location.address,
          point: { lat: session.location.lat, lng: session.location.lng },
          bookable: session.location.rooms.length > 0,
          openingHours: session.location.openingHours,
          distanceKm: null,
        }
      : null,
    onlineUrl: session.onlineUrl,
    bookingId: session.bookingId,
    status: session.status,
  };
}

