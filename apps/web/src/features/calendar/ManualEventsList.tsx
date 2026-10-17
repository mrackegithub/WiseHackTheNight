import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { formatSlot } from '../../lib/time';
import { toast } from '../../lib/toast';
import { eventStyle } from './event-style';
import { calendarKeys } from './queries';

/** The user's own busy blocks in the visible week, each deletable (DELETE /me/schedule/{id}). */
export function ManualEventsList({ events, onAdd }: { events: Schemas['CalendarEvent'][]; onAdd: () => void }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE('/me/schedule/{eventId}', { params: { path: { eventId: id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.info('Busy time removed.');
    },
  });

  return (
    <section aria-labelledby="busy-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="busy-heading" className="font-semibold">
          Your busy times this week
        </h2>
        <Button variant="secondary" onClick={onAdd}>
          + Add busy time
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Things that aren't in Neptun, like a job or training. You won't be matched or scheduled then. Click any block in the calendar to see or remove it.
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None this week.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
              <span className={`h-3 w-3 shrink-0 rounded ${eventStyle(e).className}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-slate-600">
                  {eventStyle(e).label} · {formatSlot(e.start, e.end)}
                </p>
              </div>
              <Button
                variant="ghost"
                className="px-3 py-1 text-red-700"
                onClick={() => remove.mutate(e.id)}
                loading={remove.isPending && remove.variables === e.id}
                aria-label={`Delete ${e.title} on ${formatSlot(e.start, e.end)}`}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
