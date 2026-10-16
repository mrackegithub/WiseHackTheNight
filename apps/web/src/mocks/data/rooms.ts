import type { Schemas } from '@sgm/contracts';
import { locations } from './locations';

/** Name of the mock room whose bookings always fail with SLOT_TAKEN (to try the "just taken" path by hand). */
export const ALWAYS_TAKEN = 'Silent room 3 (popular)';

const templates: [name: string, capacity: number, equipment: string[]][] = [
  ['Group room 1', 4, ['whiteboard']],
  ['Group room 2', 6, ['whiteboard', 'screen']],
  [ALWAYS_TAKEN, 8, ['whiteboard', 'projector']],
];

/** Every bookable location gets the same three rooms (provider MOCK). */
export const rooms: Schemas['Room'][] = locations
  .filter((l) => l.bookable)
  .flatMap((l, li) =>
    templates.map(([name, capacity, equipment], ri) => ({
      id: `00000000-0000-4000-8008-${String(li * 10 + ri + 1).padStart(12, '0')}`,
      locationId: l.id,
      name,
      capacity,
      equipment,
      provider: 'MOCK' as const,
    })),
  );

export const roomById = (id: string) => rooms.find((r) => r.id === id);
