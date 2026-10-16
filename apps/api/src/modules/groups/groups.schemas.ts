import { z } from 'zod';

export const groupIdParamsSchema = z.object({
  groupId: z.string().uuid(),
});

export const createGroupSchema = z.object({
  name: z.string().min(3).max(60),
  subjectId: z.string().uuid(),
  maxSize: z.coerce.number().int().min(2).max(10),
  description: z.string().max(300).optional(),
  isOpen: z.boolean().default(true),
});

export const suggestedSlotsQuerySchema = z.object({
  from: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date-time string for from',
  }),
  to: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date-time string for to',
  }),
  minMinutes: z.coerce.number().int().min(30).default(60),
});

export type GroupIdParams = z.infer<typeof groupIdParamsSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type SuggestedSlotsQuery = z.infer<typeof suggestedSlotsQuerySchema>;

