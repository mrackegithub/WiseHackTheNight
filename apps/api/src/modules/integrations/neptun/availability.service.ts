import type { PrismaClient } from '@prisma/client';
import {
  AvailabilityServiceImpl,
  type AvailabilityDb,
  type AvailabilityService,
  type TimeSlot,
} from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import type { WeeklyWindowInput } from './neptun.schemas.js';

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

