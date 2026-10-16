import { useMutation, useQuery } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';

export type CandidateKind = 'user' | 'group';

export const matchingKeys = {
  candidates: (subjectId: string, kind: CandidateKind) => ['matching', 'candidates', subjectId, kind] as const,
  matches: ['matching', 'matches'] as const,
};

export function useCandidates(subjectId: string, kind: CandidateKind) {
  return useQuery({
    queryKey: matchingKeys.candidates(subjectId, kind),
    queryFn: () => unwrap(api.GET('/matching/candidates', { params: { query: { subjectId, kind, limit: 10 } } })),
    staleTime: 0,
  });
}

export function useSwipe() {
  return useMutation({
    mutationFn: (body: Schemas['SwipeRequest']) => unwrap(api.POST('/matching/swipes', { body })),
  });
}
