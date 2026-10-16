import type {
  AvailabilityService,
  BookingProvider,
  GeoService,
  TimeSlot,
} from '@sgm/integrations';

/**
 * In-memory stub for AvailabilityService until Agent C's implementation is ready.
 */
export class InMemoryAvailabilityService implements AvailabilityService {
  private userSlots = new Map<string, TimeSlot[]>();
  private sessionBlocks = new Map<string, { memberIds: string[]; slot: TimeSlot }>();

  setUserSlots(userId: string, slots: TimeSlot[]) {
    this.userSlots.set(userId, slots);
  }

  async getFreeSlots(userId: string, _range: TimeSlot, minMinutes = 30): Promise<TimeSlot[]> {
    const slots = this.userSlots.get(userId) ?? [];
    return slots.filter((s) => {
      const durationMs = s.end.getTime() - s.start.getTime();
      return durationMs >= minMinutes * 60 * 1000;
    });
  }

  async getFreeSlotsBulk(
    userIds: string[],
    range: TimeSlot,
    minMinutes = 30,
  ): Promise<Map<string, TimeSlot[]>> {
    const map = new Map<string, TimeSlot[]>();
    for (const id of userIds) {
      map.set(id, await this.getFreeSlots(id, range, minMinutes));
    }
    return map;
  }

  async upsertStudySessionBlock(
    sessionId: string,
    memberIds: string[],
    slot: TimeSlot | null,
  ): Promise<void> {
    if (!slot) {
      this.sessionBlocks.delete(sessionId);
    } else {
      this.sessionBlocks.set(sessionId, { memberIds, slot });
    }
  }
}

/**
 * Pure Haversine and centroid math for GeoService stub.
 */
export class SimpleGeoService implements GeoService {
  distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371; // Earth radius in km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return Math.round(R * c * 100) / 100;
  }

  centroid(points: { lat: number; lng: number }[]): { lat: number; lng: number } {
    if (points.length === 0) {
      return { lat: 47.4979, lng: 19.0402 }; // Budapest center fallback
    }
    const sum = points.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: Math.round((sum.lat / points.length) * 1e6) / 1e6,
      lng: Math.round((sum.lng / points.length) * 1e6) / 1e6,
    };
  }
}

/**
 * Pure slot intersection implementation.
 */
export function stubIntersectSlots(
  a: TimeSlot[],
  b: TimeSlot[],
  minMinutes = 30,
): TimeSlot[] {
  const result: TimeSlot[] = [];
  const minMs = minMinutes * 60 * 1000;

  for (const slotA of a) {
    for (const slotB of b) {
      const start = new Date(Math.max(slotA.start.getTime(), slotB.start.getTime()));
      const end = new Date(Math.min(slotA.end.getTime(), slotB.end.getTime()));
      if (end.getTime() - start.getTime() >= minMs) {
        result.push({ start, end });
      }
    }
  }

  return result;
}

/**
 * In-memory Mock BookingProvider stub.
 */
export class InMemoryBookingProvider implements BookingProvider {
  readonly name = 'MOCK' as const;
  private bookings = new Map<string, { roomId: string; slot: TimeSlot; reference: string }>();

  async findFreeRooms(_q: { locationId?: string; slot: TimeSlot; capacity?: number }): Promise<{ roomId: string }[]> {
    return [];
  }

  async book(q: { roomId: string; slot: TimeSlot; reference: string }): Promise<{ externalRef: string; status: 'PENDING' | 'CONFIRMED' }> {
    const externalRef = `mock-book-${Date.now()}`;
    this.bookings.set(externalRef, q);
    return { externalRef, status: 'CONFIRMED' };
  }

  async cancel(externalRef: string): Promise<void> {
    this.bookings.delete(externalRef);
  }
}
