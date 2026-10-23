import type { PrismaClient } from '@prisma/client';
import {
  AvailabilityServiceImpl,
  DateTime,
  DEFAULT_WEEKLY_WINDOWS,
  expandWeeklyWindows,
  subtractSlots,
  type AvailabilityDb,
  type AvailabilityService,
  type TimeSlot,
  type WeeklyWindow,
} from '@sgm/integrations';
import type { paths } from '@sgm/contracts';
import { conflict, notFound } from '../../../core/errors.js';
import { cancelStudySession } from '../../sessions/sessions.service.js';
import type { ManualEventInput, WeeklyWindowInput } from './neptun.schemas.js';

export type CalendarEventResponse =
  paths['/me/schedule']['get']['responses'][200]['content']['application/json'][number];
export type TimeSlotResponse =
  paths['/me/availability']['get']['responses'][200]['content']['application/json'][number];
export type WeeklyWindowResponse =
  paths['/me/availability']['put']['responses'][200]['content']['application/json'][number];

export class AppAvailabilityService implements AvailabilityService {
  private baseService: AvailabilityServiceImpl;

  constructor(private prisma: PrismaClient) {
    this.baseService = new AvailabilityServiceImpl(prisma as unknown as AvailabilityDb);
  }

  async getFreeSlots(userId: string, range: TimeSlot, minMinutes = 30): Promise<TimeSlot[]> {
    const [windows, user, busyEvents] = await Promise.all([
      this.prisma.availabilityWindow.findMany({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { customWindows: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          start: { lt: range.end },
          end: { gt: range.start },
        },
      }),
    ]);

    let activeWindows: WeeklyWindow[];
    if (windows.length > 0) {
      activeWindows = windows;
    } else if (user?.customWindows) {
      return [];
    } else {
      activeWindows = DEFAULT_WEEKLY_WINDOWS;
    }

    const expandedWindows = expandWeeklyWindows(activeWindows, range);
    const busySlots: TimeSlot[] = busyEvents.map((e) => ({
      start: new Date(e.start),
      end: new Date(e.end),
    }));

    return subtractSlots(expandedWindows, busySlots, minMinutes);
  }

  async getFreeSlotsBulk(
    userIds: string[],
    range: TimeSlot,
    minMinutes = 30,
  ): Promise<Map<string, TimeSlot[]>> {
    const result = new Map<string, TimeSlot[]>();
    if (userIds.length === 0) return result;

    const [allWindows, allBusy, users] = await Promise.all([
      this.prisma.availabilityWindow.findMany({
        where: { userId: { in: userIds } },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId: { in: userIds },
          start: { lt: range.end },
          end: { gt: range.start },
        },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, customWindows: true },
      }),
    ]);

    const customWindowsByUser = new Map<string, boolean>();
    for (const u of users) {
      customWindowsByUser.set(u.id, u.customWindows);
    }

    const windowsByUser = new Map<string, WeeklyWindow[]>();
    for (const w of allWindows) {
      const list = windowsByUser.get(w.userId) ?? [];
      list.push(w);
      windowsByUser.set(w.userId, list);
    }

    const busyByUser = new Map<string, TimeSlot[]>();
    for (const b of allBusy) {
      const list = busyByUser.get(b.userId) ?? [];
      list.push({ start: new Date(b.start), end: new Date(b.end) });
      busyByUser.set(b.userId, list);
    }

    const expandedByWindows = new Map<string, TimeSlot[]>();
    for (const userId of userIds) {
      const userWindows = windowsByUser.get(userId);
      const isCustom = customWindowsByUser.get(userId) ?? false;

      let activeWindows: WeeklyWindow[];
      if (userWindows && userWindows.length > 0) {
        activeWindows = userWindows;
      } else if (isCustom) {
        result.set(userId, []);
        continue;
      } else {
        activeWindows = DEFAULT_WEEKLY_WINDOWS;
      }

      const userBusy = busyByUser.get(userId) ?? [];
      const key = activeWindows.map((w) => `${w.weekday} ${w.startTime}-${w.endTime}`).sort().join(',');
      let expanded = expandedByWindows.get(key);
      if (!expanded) {
        expanded = expandWeeklyWindows(activeWindows, range);
        expandedByWindows.set(key, expanded);
      }
      const free = subtractSlots(expanded, userBusy, minMinutes);
      result.set(userId, free);
    }

    return result;
  }

  async upsertStudySessionBlock(
    sessionId: string,
    memberIds: string[],
    slot: TimeSlot | null,
  ): Promise<void> {
    return this.baseService.upsertStudySessionBlock(sessionId, memberIds, slot);
  }
}

export function getAvailabilityService(prisma: PrismaClient): AvailabilityService {
  return new AppAvailabilityService(prisma);
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

  return events.map((e) => toEventResponse(e));
}

const toEventResponse = (e: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  room: string | null;
  subjectCode: string | null;
  source: CalendarEventResponse['source'];
  category?: CalendarEventResponse['category'] | null;
}): CalendarEventResponse => ({
  id: e.id,
  title: e.title,
  start: e.start.toISOString(),
  end: e.end.toISOString(),
  room: e.room ?? null,
  subjectCode: e.subjectCode ?? null,
  source: e.source,
  ...(e.category ? { category: e.category } : {}),
});

/** Busy blocks the user adds by hand; weekly copies keep the same Budapest local time across DST. */
export async function createManualEvents(
  prisma: PrismaClient,
  userId: string,
  input: ManualEventInput,
): Promise<CalendarEventResponse[]> {
  const start = DateTime.fromISO(input.start).setZone('Europe/Budapest');
  const end = DateTime.fromISO(input.end).setZone('Europe/Budapest');

  for (let week = 0; week <= input.repeatWeeks; week++) {
    const weekStart = start.plus({ weeks: week }).toJSDate();
    const weekEnd = end.plus({ weeks: week }).toJSDate();
    const conflictEvent = await prisma.calendarEvent.findFirst({
      where: {
        userId,
        start: { lt: weekEnd },
        end: { gt: weekStart },
      },
    });
    if (conflictEvent) {
      throw conflict(
        'You already have a class or busy block scheduled during this time: ' + conflictEvent.title,
        'EVENT_CONFLICT',
      );
    }
  }

  const created = await prisma.$transaction(
    Array.from({ length: input.repeatWeeks + 1 }, (_, week) =>
      prisma.calendarEvent.create({
        data: {
          userId,
          title: input.title,
          start: start.plus({ weeks: week }).toJSDate(),
          end: end.plus({ weeks: week }).toJSDate(),
          source: 'MANUAL',
          category: input.category,
        },
      }),
    ),
  );
  return created.map(toEventResponse);
}

/**
 * Removes any event from the user's calendar. A Neptun class is remembered so re-syncs don't bring it back;
 * a study session is cancelled for the whole group.
 */
export async function deleteCalendarEvent(prisma: PrismaClient, userId: string, eventId: string): Promise<void> {
  const event = await prisma.calendarEvent.findFirst({ where: { id: eventId, userId } });
  if (!event) throw notFound('Event not found');

  if (event.source === 'STUDY_SESSION' && event.externalUid) {
    await cancelStudySession(prisma, event.externalUid);
    return;
  }
  await prisma.$transaction([
    prisma.calendarEvent.delete({ where: { id: event.id } }),
    ...(event.source === 'NEPTUN' && event.externalUid
      ? [
          prisma.removedNeptunEvent.upsert({
            where: { userId_externalUid: { userId, externalUid: event.externalUid } },
            create: { userId, externalUid: event.externalUid },
            update: {},
          }),
        ]
      : []),
  ]);
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

export async function getMyAvailabilityWindows(
  prisma: PrismaClient,
  userId: string,
): Promise<WeeklyWindowResponse[]> {
  const [windows, user] = await Promise.all([
    prisma.availabilityWindow.findMany({
      where: { userId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { customWindows: true },
    }),
  ]);

  if (windows.length === 0 && !user?.customWindows) {
    return DEFAULT_WEEKLY_WINDOWS.map((w) => ({
      weekday: w.weekday,
      startTime: w.startTime,
      endTime: w.endTime,
    }));
  }

  return windows.map((w) => ({
    weekday: w.weekday,
    startTime: w.startTime,
    endTime: w.endTime,
  }));
}

export async function replaceMyAvailabilityWindows(
  prisma: PrismaClient,
  userId: string,
  windows: WeeklyWindowInput[],
): Promise<WeeklyWindowResponse[]> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { customWindows: true },
    });

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

