import { z } from 'zod';

export const getCandidatesQuerySchema = z.object({
  subjectId: z.string().uuid(),
  kind: z.enum(['user', 'group']).default('user'),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type GetCandidatesQuery = z.infer<typeof getCandidatesQuerySchema>;
