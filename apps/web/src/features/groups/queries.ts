import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { nowInZone, toApiTime } from '../../lib/time';

export const groupKeys = {
  all: ['groups'] as const,
  list: ['groups', 'list'] as const,
  detail: (groupId: string) => ['groups', groupId] as const,
  slots: (groupId: string) => ['groups', groupId, 'suggested-slots'] as const,
  sessions: (groupId: string) => ['groups', groupId, 'sessions'] as const,
};

export function useMyGroups() {
  return useQuery({ queryKey: groupKeys.list, queryFn: () => unwrap(api.GET('/groups')) });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => unwrap(api.GET('/groups/{groupId}', { params: { path: { groupId } } })),
    meta: { silent: true }, // the page shows its own not-found state
  });
}

/** Common free slots for the next `days` days, best first. */
export function useSuggestedSlots(groupId: string, days = 7, minMinutes = 60) {
  return useQuery({
    queryKey: [...groupKeys.slots(groupId), days, minMinutes],
    queryFn: () => {
      const from = nowInZone().startOf('hour').plus({ hours: 1 });
      return unwrap(
        api.GET('/groups/{groupId}/suggested-slots', {
          params: { path: { groupId }, query: { from: toApiTime(from), to: toApiTime(from.plus({ days })), minMinutes } },
        }),
      );
    },
  });
}

export function useSuggestedLocations(groupId: string, type: Schemas['LocationType'] | null, limit = 5) {
  return useQuery({
    queryKey: [...groupKeys.detail(groupId), 'suggested-locations', type, limit],
    queryFn: () =>
      unwrap(api.GET('/groups/{groupId}/suggested-locations', { params: { path: { groupId }, query: { ...(type ? { type } : {}), limit } } })),
    placeholderData: keepPreviousData,
  });
}

export function useGroupSessions(groupId: string) {
  return useQuery({
    queryKey: groupKeys.sessions(groupId),
    queryFn: () => unwrap(api.GET('/groups/{groupId}/sessions', { params: { path: { groupId } } })),
  });
}

export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE('/groups/{groupId}/members', { params: { path: { groupId } } })),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      void queryClient.invalidateQueries({ queryKey: groupKeys.list });
    },
  });
}
