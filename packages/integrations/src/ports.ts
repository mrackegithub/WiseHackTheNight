/**
 * OWNER: Agent C (integrations) — frozen in Phase 0.
 * These are the ONLY integration surfaces Agent B (backend) may import.
 * Changing a signature = Contract Change (see AGENTS.md §5).
 */

export interface TimeSlot {
  start: Date;
  end: Date;
}

/** Calendar: busy time + free slots per user. */
export interface AvailabilityService {
  /** Free slots for one user = weekly windows − busy events, merged, each ≥ minMinutes. */
  getFreeSlots(userId: string, range: TimeSlot, minMinutes?: number): Promise<TimeSlot[]>;
  /** Bulk version used by the matcher; must run ≤ 2 DB queries regardless of userIds.length. */
  getFreeSlotsBulk(userIds: string[], range: TimeSlot, minMinutes?: number): Promise<Map<string, TimeSlot[]>>;
  /** Mirror a planned study session into each member's busy calendar. */
  upsertStudySessionBlock(sessionId: string, memberIds: string[], slot: TimeSlot | null): Promise<void>;
}

/** Geo helpers (pure, no I/O) + location lookup. */
export interface GeoService {
  distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number;
  centroid(points: { lat: number; lng: number }[]): { lat: number; lng: number };
}

/** Room booking adapter. One implementation per provider (MOCK, LIBCAL, MS_GRAPH). */
export interface BookingProvider {
  readonly name: 'MOCK' | 'LIBCAL' | 'MS_GRAPH';
  findFreeRooms(q: { locationId?: string; slot: TimeSlot; capacity?: number }): Promise<{ roomId: string }[]>;
  book(q: { roomId: string; slot: TimeSlot; reference: string }): Promise<{ externalRef: string; status: 'PENDING' | 'CONFIRMED' }>;
  cancel(externalRef: string): Promise<void>;
}

/** Pure overlap helper shared by calendar + matching. */
export declare function intersectSlots(a: TimeSlot[], b: TimeSlot[], minMinutes?: number): TimeSlot[];
