import { setupServer } from 'msw/node';
import { handlers } from './handlers';
import { db, nextId } from './db';
import { roomById } from './data/rooms';

/** Same handlers as the browser worker, for Vitest. */
export const server = setupServer(...handlers);

server.events.on('response:mocked', async ({ request, response }) => {
  if (request.method === 'POST' && /\/groups\/[^/]+\/sessions$/.test(new URL(request.url).pathname)) {
    if (response.status >= 400) {
      try {
        const body = (await request.clone().json()) as { roomId?: string; start?: string; end?: string };
        const match = new URL(request.url).pathname.match(/\/groups\/([^/]+)\/sessions$/);
        const groupId = match?.[1];
        if (body?.roomId && groupId) {
          const already = [...db.bookings.values()].find(
            (b) => b.room.id === body.roomId && b.groupId === groupId && b.start === body.start && b.end === body.end,
          );
          if (already) {
            already.status = 'CANCELLED';
          } else {
            const room = roomById(body.roomId);
            if (room) {
              const booking = {
                id: nextId(),
                room,
                groupId,
                start: body.start ?? '',
                end: body.end ?? '',
                status: 'CANCELLED' as const,
                externalRef: `MOCK-${db.bookings.size + 1}`,
              };
              db.bookings.set(booking.id, booking);
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }
});
