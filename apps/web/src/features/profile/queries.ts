import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';

export const profileKeys = {
  subjects: ['me', 'subjects'] as const,
  subjectSearch: (q: string) => ['subjects', 'search', q] as const,
};

export function useMySubjects() {
  return useQuery({ queryKey: profileKeys.subjects, queryFn: () => unwrap(api.GET('/me/subjects')) });
}

export function useSubjectSearch(q: string, limit = 8) {
  return useQuery({
    queryKey: profileKeys.subjectSearch(q),
    queryFn: () => unwrap(api.GET('/subjects', { params: { query: { q: q || undefined, limit } } })),
    placeholderData: keepPreviousData,
  });
}
