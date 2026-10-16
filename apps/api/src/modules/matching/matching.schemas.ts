import { z } from 'zod';

export const getCandidatesQuerySchema = z.object({
  subjectId: z.string().uuid(),
  kind: z.enum(['user', 'group']).default('user'),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const swipeRequestSchema = z.object({
  targetKind: z.enum(['user', 'group']),
  targetId: z.string().uuid(),
  subjectId: z.string().uuid(),
  direction: z.enum(['LIKE', 'PASS']),
});

export const listMatchesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GetCandidatesQuery = z.infer<typeof getCandidatesQuerySchema>;
export type SwipeRequest = z.infer<typeof swipeRequestSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
