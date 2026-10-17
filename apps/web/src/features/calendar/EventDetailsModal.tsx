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

/** What removing does for each source (DELETE /me/schedule/{id}). */
const removal: Record<Schemas['CalendarEvent']['source'], { note: string | null; button: string; done: string }> = {
  MANUAL: { note: null, button: 'Remove from calendar', done: 'Removed from your calendar.' },
  NEPTUN: {
    note: 'Imported from your Neptun calendar. Removing it hides this class here and future Neptun syncs won’t bring it back.',
    button: 'Remove this class',
    done: 'Class removed from your calendar.',
  },
  STUDY_SESSION: {
    note: 'A study session of one of your groups. Removing it cancels the session for everyone in the group.',
    button: 'Cancel session',
    done: 'Study session cancelled for the group.',
  },
};

/** Details of a calendar block, with a button to remove it whatever its source. */
export function EventDetailsModal({ event, onClose }: { event: Schemas['CalendarEvent']; onClose: () => void }) {
  const queryClient = useQueryClient();
  const style = eventStyle(event);
  const copy = removal[event.source];
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/me/schedule/{eventId}', { params: { path: { eventId: event.id } } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      if (event.source === 'STUDY_SESSION') void queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (event.source === 'NEPTUN') void queryClient.invalidateQueries({ queryKey: ['me', 'neptun'] }); // class count
      toast.info(copy.done);
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

        {copy.note && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{copy.note}</p>}
        {event.source === 'STUDY_SESSION' && (
          <p className="text-sm text-slate-600">
            To move it instead, go to your{' '}
            <Link to="/groups" className="font-medium text-indigo-700 hover:underline">
              groups
            </Link>
            .
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} data-autofocus>
            Close
          </Button>
          <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
            {copy.button}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
