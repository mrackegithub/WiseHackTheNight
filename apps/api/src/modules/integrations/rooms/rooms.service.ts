import type { PrismaClient } from '@prisma/client';
import {
  LibCalProvider,
  MockBookingProvider,
  MsGraphProvider,
  type BookingDb,
} from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import { conflict, forbidden, notFound } from '../../../core/errors.js';
import type { CreateBookingInput, SearchRoomsQuery } from './rooms.schemas.js';

function getBookingProvider(provider: string, db?: BookingDb) {
  if (provider === 'LIBCAL') return new LibCalProvider();
  if (provider === 'MS_GRAPH') return new MsGraphProvider();
  return new MockBookingProvider(db);
}

export type RoomDto =
  paths['/rooms']['get']['responses'][200]['content']['application/json'][number];
export type BookingDto =
  paths['/bookings']['post']['responses'][201]['content']['application/json'];

export async function searchRooms(
  prisma: PrismaClient,
  query: SearchRoomsQuery,
): Promise<RoomDto[]> {
  const start = new Date(query.start);
  const end = new Date(query.end);

  const whereClause: {
    locationId?: string;
    capacity?: { gte: number };
  } = {};

  if (query.locationId) {
    whereClause.locationId = query.locationId;
  }
  if (query.capacity) {
    whereClause.capacity = { gte: query.capacity };
  }

  const allRooms = await prisma.room.findMany({
    where: whereClause,
  });

  if (allRooms.length === 0) return [];

  const roomIds = allRooms.map((r) => r.id);

  const conflictingBookings = await prisma.booking.findMany({
    where: {
      roomId: { in: roomIds },
      start: { lt: end },
      end: { gt: start },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: { roomId: true },
  });

  const busyRoomIds = new Set(conflictingBookings.map((b) => b.roomId));

  return allRooms
    .filter((r) => !busyRoomIds.has(r.id))
    .map((r) => ({
      id: r.id,
      locationId: r.locationId,
      name: r.name,
      capacity: r.capacity,
      equipment: r.equipment,
      provider: r.provider,
    }));
}

export async function createBooking(
  prisma: PrismaClient,
  userId: string,
  data: CreateBookingInput,
): Promise<BookingDto> {
  const room = await prisma.room.findUnique({
    where: { id: data.roomId },
  });
  if (!room) {
    throw notFound('Room not found', 'NOT_FOUND');
  }

  const group = await prisma.group.findUnique({
    where: { id: data.groupId },
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

  return prisma.$transaction(async (tx) => {
    // Check for overlapping bookings
    const conflictBooking = await tx.booking.findFirst({
      where: {
        roomId: data.roomId,
        start: { lt: end },
        end: { gt: start },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (conflictBooking) {
      throw conflict('Room is already booked for this time interval', 'SLOT_TAKEN');
    }

    // Call booking provider to generate external reference
    const provider = getBookingProvider(room.provider, prisma as unknown as BookingDb);
    const bookResult = await provider.book({
      roomId: data.roomId,
      slot: { start, end },
      reference: `group-${data.groupId}`,
    });

    const booking = await tx.booking.create({
      data: {
        roomId: data.roomId,
        groupId: data.groupId,
        bookedById: userId,
        start,
        end,
        status: bookResult.status,
        externalRef: bookResult.externalRef,
      },
      include: {
        room: true,
      },
    });

    return {
      id: booking.id,
      room: {
        id: booking.room.id,
        locationId: booking.room.locationId,
        name: booking.room.name,
        capacity: booking.room.capacity,
        equipment: booking.room.equipment,
        provider: booking.room.provider,
      },
      groupId: booking.groupId,
      start: booking.start.toISOString(),
      end: booking.end.toISOString(),
      status: booking.status,
      externalRef: booking.externalRef ?? null,
    };
  });
}

export async function getBooking(
  prisma: PrismaClient,
  bookingId: string,
): Promise<BookingDto> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
    },
  });

  if (!booking) {
    throw notFound('Booking not found', 'NOT_FOUND');
  }

  return {
    id: booking.id,
    room: {
      id: booking.room.id,
      locationId: booking.room.locationId,
      name: booking.room.name,
      capacity: booking.room.capacity,
      equipment: booking.room.equipment,
      provider: booking.room.provider,
    },
    groupId: booking.groupId,
    start: booking.start.toISOString(),
    end: booking.end.toISOString(),
    status: booking.status,
    externalRef: booking.externalRef ?? null,
  };
}

export async function cancelBooking(
  prisma: PrismaClient,
  bookingId: string,
  userId?: string,
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
      group: {
        include: {
          members: { select: { userId: true } },
        },
      },
    },
  });

  if (!booking) {
    throw notFound('Booking not found', 'NOT_FOUND');
  }

  if (userId) {
    const isAuthorized =
      booking.group.members.some((m) => m.userId === userId) ||
      (booking.group.members.length === 0 && booking.bookedById === userId);
    if (!isAuthorized) {
      throw forbidden('Not authorized to cancel this booking', 'FORBIDDEN');
    }
  }

  const provider = getBookingProvider(booking.room.provider, prisma as unknown as BookingDb);
  if (booking.externalRef) {
    await provider.cancel(booking.externalRef);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
    },
  });
}

