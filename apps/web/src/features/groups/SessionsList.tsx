import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { QueryError } from '../../components/QueryError';
import { Spinner } from '../../components/Spinner';
import { formatSlot } from '../../lib/time';
import { useGroupSessions } from './queries';

const statusBadge: Record<Schemas['StudySession']['status'], { label: string; className: string }> = {
  PLANNED: { label: 'Planned', className: 'bg-indigo-100 text-indigo-800' },
  DONE: { label: 'Done', className: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

const bookingLabel: Record<Schemas['Booking']['status'], string> = {
  CONFIRMED: 'booked',
  PENDING: 'booking pending',
  CANCELLED: 'booking cancelled',
  FAILED: 'booking failed',
};

/** "· Group room 2 booked" for sessions linked to a room booking. */
function BookedRoom({ bookingId }: { bookingId: string }) {
  const booking = useQuery({
    queryKey: ['bookings', bookingId],
    queryFn: () => unwrap(api.GET('/bookings/{bookingId}', { params: { path: { bookingId } } })),
    meta: { silent: true },
  });
  if (!booking.data) return null;
  return (
    <span className={booking.data.status === 'CONFIRMED' ? 'text-emerald-700' : 'text-amber-700'}>
      {' '}
      · {booking.data.room.name} {bookingLabel[booking.data.status]}
    </span>
  );
}

function Where({ session: s }: { session: Schemas['StudySession'] }) {
  if (s.location) {
    return (
      <>
        {s.location.name}
        {s.bookingId && <BookedRoom bookingId={s.bookingId} />}
      </>
    );
  }
  if (s.onlineUrl) {
    return (
      <a href={s.onlineUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
        Online meeting
      </a>
    );
  }
  return <span className="text-slate-500">Place not set</span>;
}

export function SessionsList({ groupId }: { groupId: string }) {
  const sessions = useGroupSessions(groupId);
  const [now] = useState(() => Date.now()); // render must stay pure; "now" as of mount is fine here
  const upcoming = (sessions.data ?? []).filter((s) => Date.parse(s.end) >= now);
  const past = (sessions.data ?? []).filter((s) => Date.parse(s.end) < now).reverse();

  return (
    <section aria-labelledby="sessions-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="sessions-heading" className="font-semibold">
        Sessions
      </h2>
      {sessions.isPending ? (
        <Spinner label="Loading sessions" />
      ) : sessions.isError ? (
        <QueryError compact what="sessions" error={sessions.error} onRetry={() => void sessions.refetch()} />
      ) : sessions.data.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {[...upcoming, ...past].map((s) => {
            const isPast = Date.parse(s.end) < now;
            return (
              <li key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 ${isPast ? 'bg-white text-slate-500' : 'bg-slate-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatSlot(s.start, s.end)}</p>
                  <p className="text-xs">
                    <Where session={s} />
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[s.status].className}`}>{statusBadge[s.status].label}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No sessions planned yet. Pick one of the suggested times.</p>
      )}
    </section>
  );
}
