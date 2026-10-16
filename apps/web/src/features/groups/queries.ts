import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';

export const groupKeys = {
  all: ['groups'] as const,
  detail: (groupId: string) => ['groups', groupId] as const,
};

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => unwrap(api.GET('/groups/{groupId}', { params: { path: { groupId } } })),
    meta: { silent: true }, // the page shows its own not-found state
  });
}
