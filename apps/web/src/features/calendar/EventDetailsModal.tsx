import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { Modal } from '../../components/Modal';
import { formatSlot } from '../../lib/time';
import { toast } from '../../lib/toast';
import { eventStyle } from './event-style';
import { calendarKeys } from './queries';

/** Details of a calendar block; your own busy times can be removed from here. */
export function EventDetailsModal({ event, onClose }: { event: Schemas['CalendarEvent']; onClose: () => void }) {
  const queryClient = useQueryClient();
  const style = eventStyle(event);
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/me/schedule/{eventId}', { params: { path: { eventId: event.id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.info(`Removed "${event.title}" from your calendar.`);
      onClose();
    },
  });

  return (
    <Modal title={event.title} onClose={onClose} description={formatSlot(event.start, event.end)}>
      <div className="flex flex-col gap-4">
        <p className="flex items-center justify-center gap-2 text-sm text-slate-700">
          <span className={`h-3 w-3 rounded ${style.className}`} aria-hidden />
          {style.label}
          {event.room && <span className="text-slate-500">· {event.room}</span>}
        </p>

        {event.source === 'NEPTUN' && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Imported from your Neptun calendar, so it updates when Neptun changes. To stop using Neptun, disconnect it at the top of this page.
          </p>
        )}
        {event.source === 'STUDY_SESSION' && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            A study session of one of your groups. Change it on the{' '}
            <Link to="/groups" className="font-medium text-indigo-700 hover:underline">
              group page
            </Link>
            .
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Close
          </Button>
          {event.source === 'MANUAL' && (
            <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              Remove from calendar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
