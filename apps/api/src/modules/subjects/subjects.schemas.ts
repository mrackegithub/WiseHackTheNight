import { z } from 'zod';

export const listSubjectsQuerySchema = z.object({
  q: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;
