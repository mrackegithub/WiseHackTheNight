import { z } from 'zod';

export const searchRoomsQuerySchema = z
  .object({
    locationId: z.string().uuid().optional(),
    start: z.string().datetime({ offset: true }).or(z.string().datetime()),
    end: z.string().datetime({ offset: true }).or(z.string().datetime()),
    capacity: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (data) => new Date(data.start).getTime() < new Date(data.end).getTime(),
    { message: "'start' must be before 'end'", path: ['start'] },
  );

export const createBookingSchema = z
  .object({
    roomId: z.string().uuid(),
    groupId: z.string().uuid(),
    start: z.string().datetime({ offset: true }).or(z.string().datetime()),
    end: z.string().datetime({ offset: true }).or(z.string().datetime()),
  })
  .refine(
    (data) => new Date(data.start).getTime() < new Date(data.end).getTime(),
    { message: "'start' must be before 'end'", path: ['start'] },
  );

export const bookingParamsSchema = z.object({
  bookingId: z.string().uuid(),
});

export type SearchRoomsQuery = z.infer<typeof searchRoomsQuerySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type BookingParams = z.infer<typeof bookingParamsSchema>;

