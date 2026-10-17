import { useState } from 'react';
import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';
import { Button } from '../components/form/Button';
import { QueryError } from '../components/QueryError';
import { Spinner } from '../components/Spinner';
import { BusyTimeModal } from '../features/calendar/BusyTimeModal';
import { ManualEventsList } from '../features/calendar/ManualEventsList';
import { NeptunPanel } from '../features/calendar/NeptunPanel';
import { useWeekAvailability, useWeekSchedule } from '../features/calendar/queries';
import { WeekView } from '../features/calendar/WeekView';
import { WindowsEditor } from '../features/calendar/WindowsEditor';
import { formatMinutes } from '../lib/labels';
import { formatWeekRange, minutesBetween, nowInZone, startOfWeek, ZONE } from '../lib/time';
import { usePageTitle } from '../hooks/usePageTitle';

export function CalendarPage() {
  usePageTitle('Calendar');
  const [params, setParams] = useSearchParams();
  const requested = params.get('week') ? DateTime.fromISO(params.get('week')!, { zone: ZONE }) : null;
  const weekStart = startOfWeek(requested?.isValid ? requested : undefined);
  const [addingBusy, setAddingBusy] = useState(false);

  const schedule = useWeekSchedule(weekStart);
  const availability = useWeekAvailability(weekStart);

  const goTo = (week: DateTime) => setParams({ week: week.toISODate()! });
  const freeMinutes = (availability.data ?? []).reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0);
  const manualEvents = (schedule.data ?? []).filter((e) => e.source === 'MANUAL');
  // new busy time defaults to today when viewing this week, else the Monday of the viewed week
  const today = nowInZone().startOf('day');
  const defaultDate = today >= weekStart && today < weekStart.plus({ weeks: 1 }) ? today : weekStart;
  const hasClasses = (schedule.data ?? []).some((e) => e.source === 'NEPTUN');

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-600">
            Week of {formatWeekRange(weekStart)}
            {availability.data && <> · {formatMinutes(freeMinutes)} free for studying</>}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Week">
          <Button variant="secondary" onClick={() => goTo(weekStart.minus({ weeks: 1 }))} aria-label="Previous week">
            ←
          </Button>
          <Button variant="secondary" onClick={() => setParams({})}>
            This week
          </Button>
          <Button variant="secondary" onClick={() => goTo(weekStart.plus({ weeks: 1 }))} aria-label="Next week">
            →
          </Button>
          <Button onClick={() => setAddingBusy(true)}>+ Busy time</Button>
        </nav>
      </header>

      <NeptunPanel />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-indigo-600" /> Class
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-slate-600" /> Your busy time
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500" /> Study session
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-100" /> Free to study
        </span>
      </div>

      {schedule.isError || availability.isError ? (
        <QueryError
          what="your week"
          error={schedule.error ?? availability.error}
          onRetry={() => {
            void schedule.refetch();
            void availability.refetch();
          }}
        />
      ) : schedule.isPending || availability.isPending ? (
        <Spinner label="Loading your week" />
      ) : (
        <>
          <WeekView weekStart={weekStart} events={schedule.data ?? []} freeSlots={availability.data ?? []} />
          {!hasClasses && (
            <p className="text-sm text-slate-600">
              No classes this week. Connect your Neptun calendar above, or add your classes and other commitments with{' '}
              <button type="button" className="font-medium text-indigo-700 hover:underline" onClick={() => setAddingBusy(true)}>
                + Busy time
              </button>
              .
            </p>
          )}
          <ManualEventsList events={manualEvents} onAdd={() => setAddingBusy(true)} />
        </>
      )}

      <WindowsEditor />

      {addingBusy && <BusyTimeModal defaultDate={defaultDate} onClose={() => setAddingBusy(false)} />}
    </section>
  );
}
