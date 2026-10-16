import { describe, expect, it, vi } from 'vitest';
import {
  LibCalProvider,
  MockBookingProvider,
  MsGraphProvider,
  type BookingDb,
} from '../src/booking/providers';
import type { TimeSlot } from '../src/ports';

describe('Booking Providers', () => {
  const slot: TimeSlot = {
    start: new Date('2026-10-20T10:00:00Z'),
    end: new Date('2026-10-20T12:00:00Z'),
  };

  describe('MockBookingProvider', () => {
    it('finds free rooms excluding overlapping bookings', async () => {
      const fakeDb: BookingDb = {
        room: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'room-1', locationId: 'loc-1', name: 'A', capacity: 4, provider: 'MOCK' },
            { id: 'room-2', locationId: 'loc-1', name: 'B', capacity: 6, provider: 'MOCK' },
          ]),
        },
        booking: {
          findMany: vi.fn().mockResolvedValue([
            // room-1 is busy
            {
              id: 'b-1',
              roomId: 'room-1',
              start: new Date('2026-10-20T09:00:00Z'),
              end: new Date('2026-10-20T11:00:00Z'),
              status: 'CONFIRMED',
            },
          ]),
          findFirst: vi.fn(),
        },
      };

      const provider = new MockBookingProvider(fakeDb);
      const free = await provider.findFreeRooms({
        locationId: 'loc-1',
        slot,
        capacity: 4,
      });

      expect(free).toHaveLength(1);
      expect(free[0].roomId).toBe('room-2');
    });

    it('creates booking with CONFIRMED status when no overlap exists', async () => {
      const fakeDb: BookingDb = {
        room: { findMany: vi.fn() },
        booking: {
          findMany: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const provider = new MockBookingProvider(fakeDb);
      const result = await provider.book({
        roomId: 'room-1',
        slot,
        reference: 'pod-booking-1',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.externalRef).toMatch(/^mock-ref-/);
    });

    it('rejects booking with error when slot is already taken', async () => {
      const fakeDb: BookingDb = {
        room: { findMany: vi.fn() },
        booking: {
          findMany: vi.fn(),
          findFirst: vi.fn().mockResolvedValue({
            id: 'existing-b',
            roomId: 'room-1',
            start: new Date('2026-10-20T10:30:00Z'),
            end: new Date('2026-10-20T11:30:00Z'),
            status: 'CONFIRMED',
          }),
        },
      };

      const provider = new MockBookingProvider(fakeDb);
      await expect(
        provider.book({
          roomId: 'room-1',
          slot,
          reference: 'pod-booking-2',
        }),
      ).rejects.toThrow(/SLOT_TAKEN/);
    });
  });

  describe('LibCalProvider and MsGraphProvider stubs', () => {
    it('LibCalProvider returns PENDING external reference', async () => {
      const provider = new LibCalProvider();
      const res = await provider.book({
        roomId: 'lib-1',
        slot,
        reference: 'ref-1',
      });
      expect(res.status).toBe('PENDING');
      expect(res.externalRef).toContain('libcal-stub');
    });

    it('MsGraphProvider returns PENDING external reference', async () => {
      const provider = new MsGraphProvider();
      const res = await provider.book({
        roomId: 'ms-1',
        slot,
        reference: 'ref-2',
      });
      expect(res.status).toBe('PENDING');
      expect(res.externalRef).toContain('msgraph-stub');
    });
  });
});

