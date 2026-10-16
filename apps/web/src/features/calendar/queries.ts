import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DateTime } from 'luxon';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { toApiTime } from '../../lib/time';

const weekRange = (weekStart: DateTime) => ({ from: toApiTime(weekStart), to: toApiTime(weekStart.plus({ weeks: 1 })) });

export const calendarKeys = {
  all: ['me', 'calendar'] as const,
  schedule: (from: string) => ['me', 'calendar', 'schedule', from] as const,
  availability: (from: string) => ['me', 'calendar', 'availability', from] as const,
};

export function useWeekSchedule(weekStart: DateTime) {
  const query = weekRange(weekStart);
  return useQuery({
    queryKey: calendarKeys.schedule(query.from),
    queryFn: () => unwrap(api.GET('/me/schedule', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useWeekAvailability(weekStart: DateTime) {
  const query = weekRange(weekStart);
  return useQuery({
    queryKey: calendarKeys.availability(query.from),
    queryFn: () => unwrap(api.GET('/me/availability', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}
