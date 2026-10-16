import type { BookingProvider, TimeSlot } from '../ports';

export interface RoomRecord {
  id: string;
  locationId: string;
  name: string;
  capacity: number;
  equipment?: string[];
  provider: 'MOCK' | 'LIBCAL' | 'MS_GRAPH';
}

export interface BookingRecord {
  id: string;
  roomId: string;
  start: Date;
  end: Date;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
  externalRef?: string | null;
}

export interface BookingDb {
  room: {
    findMany(args: {
      where: {
        locationId?: string;
        capacity?: { gte: number };
        provider?: 'MOCK' | 'LIBCAL' | 'MS_GRAPH';
      };
    }): Promise<RoomRecord[]>;
  };
  booking: {
    findMany(args: {
      where: {
        roomId?: string | { in: string[] };
        start: { lt: Date };
        end: { gt: Date };
        status: { in: Array<'PENDING' | 'CONFIRMED'> };
      };
    }): Promise<BookingRecord[]>;
    findFirst(args: {
      where: {
        roomId: string;
        start: { lt: Date };
        end: { gt: Date };
        status: { in: Array<'PENDING' | 'CONFIRMED'> };
      };
    }): Promise<BookingRecord | null>;
  };
}

/**
 * Mock room booking provider.
 * Overlap-safe against database records.
 */
export class MockBookingProvider implements BookingProvider {
  readonly name = 'MOCK' as const;

  constructor(private db?: BookingDb) {}

  async findFreeRooms(q: {
    locationId?: string;
    slot: TimeSlot;
    capacity?: number;
  }): Promise<{ roomId: string }[]> {
    if (!this.db) return [];

    const rooms = await this.db.room.findMany({
      where: {
        locationId: q.locationId,
        capacity: q.capacity ? { gte: q.capacity } : undefined,
        provider: 'MOCK',
      },
    });

    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.id);
    const conflicting = await this.db.booking.findMany({
      where: {
        roomId: { in: roomIds },
        start: { lt: q.slot.end },
        end: { gt: q.slot.start },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    const busyRoomIds = new Set(conflicting.map((c) => c.roomId));
    return rooms.filter((r) => !busyRoomIds.has(r.id)).map((r) => ({ roomId: r.id }));
  }

  async book(q: {
    roomId: string;
    slot: TimeSlot;
    reference: string;
  }): Promise<{ externalRef: string; status: 'PENDING' | 'CONFIRMED' }> {
    if (this.db) {
      const conflict = await this.db.booking.findFirst({
        where: {
          roomId: q.roomId,
          start: { lt: q.slot.end },
          end: { gt: q.slot.start },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      });

      if (conflict) {
        throw new Error('SLOT_TAKEN: Room is already booked for this interval');
      }
    }

    const externalRef = `mock-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      externalRef,
      status: 'CONFIRMED',
    };
  }

  async cancel(_externalRef: string): Promise<void> {
    // Mock provider cancellation is a no-op external call
  }
}

/**
 * SpringShare LibCal provider stub.
 */
export class LibCalProvider implements BookingProvider {
  readonly name = 'LIBCAL' as const;

  async findFreeRooms(_q: {
    locationId?: string;
    slot: TimeSlot;
    capacity?: number;
  }): Promise<{ roomId: string }[]> {
    return [];
  }

  async book(_q: {
    roomId: string;
    slot: TimeSlot;
    reference: string;
  }): Promise<{ externalRef: string; status: 'PENDING' | 'CONFIRMED' }> {
    return {
      externalRef: `libcal-stub-${Date.now()}`,
      status: 'PENDING',
    };
  }

  async cancel(_externalRef: string): Promise<void> {}
}

/**
 * Microsoft Graph (Outlook Rooms) provider stub.
 */
export class MsGraphProvider implements BookingProvider {
  readonly name = 'MS_GRAPH' as const;

  async findFreeRooms(_q: {
    locationId?: string;
    slot: TimeSlot;
    capacity?: number;
  }): Promise<{ roomId: string }[]> {
    return [];
  }

  async book(_q: {
    roomId: string;
    slot: TimeSlot;
    reference: string;
  }): Promise<{ externalRef: string; status: 'PENDING' | 'CONFIRMED' }> {
    return {
      externalRef: `msgraph-stub-${Date.now()}`,
      status: 'PENDING',
    };
  }

  async cancel(_externalRef: string): Promise<void> {}
}

