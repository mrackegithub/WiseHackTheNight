import type { PrismaClient } from '@prisma/client';
import {
  AvailabilityServiceImpl,
  DateTime,
  type AvailabilityDb,
  type AvailabilityService,
  type TimeSlot,
} from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import { notFound } from '../../../core/errors.js';
import type { ManualEventInput, WeeklyWindowInput } from './neptun.schemas.js';

export type CalendarEventResponse =
  paths['/me/schedule']['get']['responses'][200]['content']['application/json'][number];
export type TimeSlotResponse =
  paths['/me/availability']['get']['responses'][200]['content']['application/json'][number];
export type WeeklyWindowResponse =
  paths['/me/availability']['put']['responses'][200]['content']['application/json'][number];

export function getAvailabilityService(prisma: PrismaClient): AvailabilityService {
  return new AvailabilityServiceImpl(prisma as unknown as AvailabilityDb);
}

export async function getMySchedule(
  prisma: PrismaClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarEventResponse[]> {
  const events = await prisma.calendarEvent.findMany({
    where: {
      userId,
      start: { lt: to },
      end: { gt: from },
    },
    orderBy: { start: 'asc' },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
    room: e.room ?? null,
    subjectCode: e.subjectCode ?? null,
    source: e.source,
  }));
}

const toEventResponse = (e: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  room: string | null;
  subjectCode: string | null;
  source: CalendarEventResponse['source'];
}): CalendarEventResponse => ({
  id: e.id,
  title: e.title,
  start: e.start.toISOString(),
  end: e.end.toISOString(),
  room: e.room ?? null,
  subjectCode: e.subjectCode ?? null,
  source: e.source,
});

/** Busy blocks the user adds by hand; weekly copies keep the same Budapest local time across DST. */
export async function createManualEvents(
  prisma: PrismaClient,
  userId: string,
  input: ManualEventInput,
): Promise<CalendarEventResponse[]> {
  const start = DateTime.fromISO(input.start).setZone('Europe/Budapest');
  const end = DateTime.fromISO(input.end).setZone('Europe/Budapest');
  const created = await prisma.$transaction(
    Array.from({ length: input.repeatWeeks + 1 }, (_, week) =>
      prisma.calendarEvent.create({
        data: {
          userId,
          title: input.title,
          start: start.plus({ weeks: week }).toJSDate(),
          end: end.plus({ weeks: week }).toJSDate(),
          source: 'MANUAL',
        },
      }),
    ),
  );
  return created.map(toEventResponse);
}

export async function deleteManualEvent(prisma: PrismaClient, userId: string, eventId: string): Promise<void> {
  const { count } = await prisma.calendarEvent.deleteMany({ where: { id: eventId, userId, source: 'MANUAL' } });
  if (count === 0) throw notFound('Busy time not found');
}

export async function getMyAvailability(
  prisma: PrismaClient,
  userId: string,
  from: Date,
  to: Date,
): Promise<TimeSlotResponse[]> {
  const service = getAvailabilityService(prisma);
  const range: TimeSlot = { start: from, end: to };
  const freeSlots = await service.getFreeSlots(userId, range, 30);

  return freeSlots.map((s) => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  }));
}

export async function replaceMyAvailabilityWindows(
  prisma: PrismaClient,
  userId: string,
  windows: WeeklyWindowInput[],
): Promise<WeeklyWindowResponse[]> {
  await prisma.$transaction(async (tx) => {
    await tx.availabilityWindow.deleteMany({
      where: { userId },
    });

    if (windows.length > 0) {
      await tx.availabilityWindow.createMany({
        data: windows.map((w) => ({
          userId,
          weekday: w.weekday,
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      });
    }
  });

  return windows.map((w) => ({
    weekday: w.weekday,
    startTime: w.startTime,
    endTime: w.endTime,
  }));
}

