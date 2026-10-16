import { describe, expect, it, vi } from 'vitest';
import {
  AvailabilityServiceImpl,
  type AvailabilityDb,
  type AvailabilityWindowRecord,
  type CalendarEventRecord,
} from '../src/slots/availability';
import type { TimeSlot } from '../src/ports';

describe('AvailabilityServiceImpl', () => {
  it('uses DEFAULT_WEEKLY_WINDOWS when user has no windows defined', async () => {
    const windowsDb: AvailabilityWindowRecord[] = [];
    const eventsDb: CalendarEventRecord[] = [
      {
        userId: 'user-1',
        title: 'Algorithms Lecture',
        start: new Date('2026-10-19T08:00:00Z'), // Monday
        end: new Date('2026-10-19T10:00:00Z'),
        source: 'NEPTUN',
      },
    ];

    const fakeDb: AvailabilityDb = {
      availabilityWindow: {
        findMany: vi.fn().mockResolvedValue(windowsDb),
      },
      calendarEvent: {
        findMany: vi.fn().mockResolvedValue(eventsDb),
      },
    };

    const service = new AvailabilityServiceImpl(fakeDb);
    const range: TimeSlot = {
      start: new Date('2026-10-19T00:00:00Z'),
      end: new Date('2026-10-19T23:59:59Z'),
    };

    const slots = await service.getFreeSlots('user-1', range, 30);
    expect(fakeDb.availabilityWindow.findMany).toHaveBeenCalledTimes(1);
    expect(fakeDb.calendarEvent.findMany).toHaveBeenCalledTimes(1);

    // Monday default is 08:00-20:00 local (06:00-18:00 UTC in CEST).
    // Busy is 08:00-10:00 UTC.
    // So free slots should be 06:00-08:00 and 10:00-18:00.
    expect(slots.length).toBe(2);
    expect(slots[0].start.toISOString()).toBe('2026-10-19T06:00:00.000Z');
    expect(slots[0].end.toISOString()).toBe('2026-10-19T08:00:00.000Z');
    expect(slots[1].start.toISOString()).toBe('2026-10-19T10:00:00.000Z');
    expect(slots[1].end.toISOString()).toBe('2026-10-19T18:00:00.000Z');
  });

  it('runs getFreeSlotsBulk in exactly 2 DB queries regardless of userIds count', async () => {
    const userIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

    const fakeDb: AvailabilityDb = {
      availabilityWindow: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'user-1', weekday: 1, startTime: '10:00', endTime: '14:00' },
          { userId: 'user-2', weekday: 1, startTime: '12:00', endTime: '18:00' },
        ]),
      },
      calendarEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new AvailabilityServiceImpl(fakeDb);
    const range: TimeSlot = {
      start: new Date('2026-10-19T00:00:00Z'),
      end: new Date('2026-10-19T23:59:59Z'),
    };

    const bulkMap = await service.getFreeSlotsBulk(userIds, range, 30);

    // EXACTLY 2 DB queries verified
    expect(fakeDb.availabilityWindow.findMany).toHaveBeenCalledTimes(1);
    expect(fakeDb.calendarEvent.findMany).toHaveBeenCalledTimes(1);

    expect(bulkMap.size).toBe(5);
    expect(bulkMap.has('user-1')).toBe(true);
    expect(bulkMap.has('user-2')).toBe(true);
    expect(bulkMap.has('user-3')).toBe(true);
  });

  it('upserts study session blocks for all members', async () => {
    const upsertMock = vi.fn().mockResolvedValue({});
    const transactionMock = vi.fn().mockImplementation(async (promises) => Promise.all(promises));

    const fakeDb: AvailabilityDb = {
      availabilityWindow: { findMany: vi.fn() },
      calendarEvent: {
        findMany: vi.fn(),
        upsert: upsertMock,
      },
      $transaction: transactionMock,
    };

    const service = new AvailabilityServiceImpl(fakeDb);
    const members = ['user-1', 'user-2'];
    const slot: TimeSlot = {
      start: new Date('2026-10-20T14:00:00Z'),
      end: new Date('2026-10-20T16:00:00Z'),
    };

    await service.upsertStudySessionBlock('session-123', members, slot);

    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it('deletes study session blocks when slot is null', async () => {
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 2 });

    const fakeDb: AvailabilityDb = {
      availabilityWindow: { findMany: vi.fn() },
      calendarEvent: {
        findMany: vi.fn(),
        deleteMany: deleteManyMock,
      },
    };

    const service = new AvailabilityServiceImpl(fakeDb);
    const members = ['user-1', 'user-2'];

    await service.upsertStudySessionBlock('session-123', members, null);

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        source: 'STUDY_SESSION',
        externalUid: 'session-123',
        userId: { in: members },
      },
    });
  });
});

