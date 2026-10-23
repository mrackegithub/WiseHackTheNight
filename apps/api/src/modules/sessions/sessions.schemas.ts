import { z } from 'zod';

export const groupIdParamsSchema = z.object({
  groupId: z.string().uuid(),
});

export const sessionParamsSchema = z.object({
  groupId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const createSessionSchema = z.object({
  start: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date-time',
  }),
  end: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date-time',
  }),
  locationId: z.string().uuid().optional(),
  onlineUrl: z.string().url().optional(),
  bookingId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
});

export type GroupIdParams = z.infer<typeof groupIdParamsSchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

