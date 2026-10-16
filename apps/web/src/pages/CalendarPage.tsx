import { DateTime } from 'luxon';
import { useSearchParams } from 'react-router';
import { Button } from '../components/form/Button';
import { Spinner } from '../components/Spinner';
import { useWeekAvailability, useWeekSchedule } from '../features/calendar/queries';
import { WeekView } from '../features/calendar/WeekView';
import { formatMinutes } from '../lib/labels';
import { formatWeekRange, minutesBetween, startOfWeek, ZONE } from '../lib/time';

export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('week') ? DateTime.fromISO(params.get('week')!, { zone: ZONE }) : null;
  const weekStart = startOfWeek(requested?.isValid ? requested : undefined);

  const schedule = useWeekSchedule(weekStart);
  const availability = useWeekAvailability(weekStart);

  const goTo = (week: DateTime) => setParams({ week: week.toISODate()! });
  const freeMinutes = (availability.data ?? []).reduce((sum, s) => sum + minutesBetween(s.start, s.end), 0);

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
        <nav className="flex gap-2" aria-label="Week">
          <Button variant="secondary" onClick={() => goTo(weekStart.minus({ weeks: 1 }))} aria-label="Previous week">
            ←
          </Button>
          <Button variant="secondary" onClick={() => setParams({})}>
            This week
          </Button>
          <Button variant="secondary" onClick={() => goTo(weekStart.plus({ weeks: 1 }))} aria-label="Next week">
            →
          </Button>
        </nav>
      </header>

      <div className="flex gap-4 text-xs text-slate-600" aria-hidden>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-indigo-600" /> Class
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500" /> Study session
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-100" /> Free to study
        </span>
      </div>

      {schedule.isPending || availability.isPending ? (
        <Spinner label="Loading your week" />
      ) : (
        <>
          <WeekView weekStart={weekStart} events={schedule.data ?? []} freeSlots={availability.data ?? []} />
          {schedule.data?.length === 0 && (
            <p className="text-sm text-slate-600">No classes this week. Connect your Neptun calendar so we can find times that really work.</p>
          )}
        </>
      )}
    </section>
  );
}
