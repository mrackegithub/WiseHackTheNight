import type { AvailabilityService, TimeSlot } from '../ports';
import { subtractSlots } from './slots';
import { expandWeeklyWindows, type WeeklyWindow } from './windows';

export interface AvailabilityWindowRecord {
  userId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface CalendarEventRecord {
  id?: string;
  userId: string;
  title: string;
  start: Date;
  end: Date;
  room?: string | null;
  subjectCode?: string | null;
  source: 'NEPTUN' | 'MANUAL' | 'STUDY_SESSION';
  externalUid?: string | null;
}

export interface AvailabilityDb {
  availabilityWindow: {
    findMany(args: {
      where: {
        userId?: string | { in: string[] };
      };
    }): Promise<AvailabilityWindowRecord[]>;
    createMany?(args: { data: AvailabilityWindowRecord[] }): Promise<{ count: number }>;
    deleteMany?(args: { where: { userId: string } }): Promise<{ count: number }>;
  };
  calendarEvent: {
    findMany(args: {
      where: {
        userId?: string | { in: string[] };
        start?: { lt: Date };
        end?: { gt: Date };
      };
      orderBy?: { start: 'asc' | 'desc' };
    }): Promise<CalendarEventRecord[]>;
    upsert?(args: {
      where: {
        userId_source_externalUid: {
          userId: string;
          source: 'NEPTUN' | 'MANUAL' | 'STUDY_SESSION';
          externalUid: string;
        };
      };
      update: Partial<CalendarEventRecord>;
      create: CalendarEventRecord;
    }): Promise<CalendarEventRecord>;
    deleteMany?(args: {
      where: {
        source?: 'NEPTUN' | 'MANUAL' | 'STUDY_SESSION';
        externalUid?: string | null;
        userId?: string | { in: string[] };
      };
    }): Promise<{ count: number }>;
  };
  $transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
  $transaction?<T>(promises: Promise<T>[]): Promise<T[]>;
}

// Default recurring weekly study hours when a user hasn't configured custom windows
// Mon–Fri 08:00–20:00 Europe/Budapest
export const DEFAULT_WEEKLY_WINDOWS: WeeklyWindow[] = [
  { weekday: 1, startTime: '08:00', endTime: '20:00' }, // Monday
  { weekday: 2, startTime: '08:00', endTime: '20:00' }, // Tuesday
  { weekday: 3, startTime: '08:00', endTime: '20:00' }, // Wednesday
  { weekday: 4, startTime: '08:00', endTime: '20:00' }, // Thursday
  { weekday: 5, startTime: '08:00', endTime: '20:00' }, // Friday
];

/**
 * Implementation of AvailabilityService backed by a database client (Prisma or in-memory fake).
 */
export class AvailabilityServiceImpl implements AvailabilityService {
  constructor(private db: AvailabilityDb) {}

  /**
   * Free slots for one user = weekly windows − busy events, merged, each ≥ minMinutes.
   */
  async getFreeSlots(userId: string, range: TimeSlot, minMinutes = 30): Promise<TimeSlot[]> {
    const windows = await this.db.availabilityWindow.findMany({
      where: { userId },
    });

    const activeWindows = windows.length > 0 ? windows : DEFAULT_WEEKLY_WINDOWS;

    const busyEvents = await this.db.calendarEvent.findMany({
      where: {
        userId,
        start: { lt: range.end },
        end: { gt: range.start },
      },
    });

    const expandedWindows = expandWeeklyWindows(activeWindows, range);
    const busySlots: TimeSlot[] = busyEvents.map((e) => ({
      start: new Date(e.start),
      end: new Date(e.end),
    }));

    return subtractSlots(expandedWindows, busySlots, minMinutes);
  }

  /**
   * Bulk version used by the matcher; runs in exactly 2 DB queries regardless of userIds.length.
   */
  async getFreeSlotsBulk(
    userIds: string[],
    range: TimeSlot,
    minMinutes = 30,
  ): Promise<Map<string, TimeSlot[]>> {
    const result = new Map<string, TimeSlot[]>();
    if (userIds.length === 0) return result;

    // Exactly 2 DB queries regardless of userIds.length
    const [allWindows, allBusy] = await Promise.all([
      this.db.availabilityWindow.findMany({
        where: { userId: { in: userIds } },
      }),
      this.db.calendarEvent.findMany({
        where: {
          userId: { in: userIds },
          start: { lt: range.end },
          end: { gt: range.start },
        },
      }),
    ]);

    // Group windows and events by userId
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

    // Most people share the same weekly hours (often the defaults): expand each distinct set once, not per user
    const expandedByWindows = new Map<string, TimeSlot[]>();
    for (const userId of userIds) {
      const userWindows = windowsByUser.get(userId);
      const activeWindows =
        userWindows && userWindows.length > 0 ? userWindows : DEFAULT_WEEKLY_WINDOWS;
      const userBusy = busyByUser.get(userId) ?? [];

      const key = activeWindows.map((w) => `${w.weekday} ${w.startTime}-${w.endTime}`).sort().join(',');
      let expanded = expandedByWindows.get(key);
      if (!expanded) {
        expanded = expandWeeklyWindows(activeWindows, range);
        expandedByWindows.set(key, expanded);
      }
      const free = subtractSlots(expanded, userBusy, minMinutes); // copies its input, so sharing is safe
      result.set(userId, free);
    }

    return result;
  }

  /**
   * Mirror a planned study session into each member's busy calendar (or remove it when slot is null).
   */
  async upsertStudySessionBlock(
    sessionId: string,
    memberIds: string[],
    slot: TimeSlot | null,
  ): Promise<void> {
    if (memberIds.length === 0) return;

    if (!slot) {
      if (this.db.calendarEvent.deleteMany) {
        await this.db.calendarEvent.deleteMany({
          where: {
            source: 'STUDY_SESSION',
            externalUid: sessionId,
            userId: { in: memberIds },
          },
        });
      }
      return;
    }

    if (!this.db.calendarEvent.upsert) {
      return;
    }

    const upsertPromises = memberIds.map((userId) =>
      this.db.calendarEvent.upsert!({
        where: {
          userId_source_externalUid: {
            userId,
            source: 'STUDY_SESSION',
            externalUid: sessionId,
          },
        },
        update: {
          start: slot.start,
          end: slot.end,
          title: 'Study Session',
        },
        create: {
          userId,
          source: 'STUDY_SESSION',
          externalUid: sessionId,
          title: 'Study Session',
          start: slot.start,
          end: slot.end,
        },
      }),
    );

    if (this.db.$transaction) {
      await this.db.$transaction(upsertPromises);
    } else {
      await Promise.all(upsertPromises);
    }
  }
}

