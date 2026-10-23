import type { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { formatTimeRange, nowInZone } from '../../lib/time';
import { eventStyle } from './event-style';
import { computeVisibleRange, HOUR_PX, place, type Block } from './visible-range';

interface WeekViewProps {
  weekStart: DateTime;
  events: Schemas['CalendarEvent'][];
  freeSlots: Schemas['TimeSlot'][];
  /** Clicking an event opens its details (and Remove for your own busy times). */
  onSelectEvent?: (event: Schemas['CalendarEvent']) => void;
}

export function WeekView({ weekStart, events, freeSlots, onSelectEvent }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));
  const today = nowInZone().startOf('day');
  const { startHour, endHour } = computeVisibleRange(events, days);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] border-b border-slate-200 text-center text-xs">
          <span />
          {days.map((d) => (
            <div key={d.toISODate()} className={`py-2 ${d.hasSame(today, 'day') ? 'font-semibold text-indigo-700' : 'text-slate-600'}`}>
              {d.toFormat('ccc')} <span className="block text-base">{d.toFormat('d')}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
          <div className="relative" style={{ height }} aria-hidden>
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-slate-500" style={{ top: (h - startHour) * HOUR_PX }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const slotBlocks = freeSlots.map((s, i) => place(day, s.start, s.end, `slot-${i}-${day.toISODate()}`, startHour, endHour)).filter((b): b is Block => b !== null);
            const eventBlocks = events
              .map((ev) => ({ ev, block: place(day, ev.start, ev.end, `${ev.id}-${day.toISODate()}`, startHour, endHour) }))
              .filter((x): x is { ev: Schemas['CalendarEvent']; block: Block } => x.block !== null);
            return (
              <section
                key={day.toISODate()}
                aria-label={day.toFormat('cccc d LLLL')}
                className="relative border-l border-slate-100"
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(241 245 249) ${HOUR_PX - 1}px, rgb(241 245 249) ${HOUR_PX}px)`,
                }}
              >
                <ul>
                  {slotBlocks.map((b) => (
                    <li
                      key={b.key}
                      aria-label={`Free ${formatTimeRange(b.start, b.end)}`}
                      className="absolute inset-x-0.5 rounded bg-emerald-100/70 px-1 text-[10px] text-emerald-800"
                      style={{ top: b.top, height: b.height }}
                    >
                      {b.height >= 22 && 'Free'}
                    </li>
                  ))}
                  {eventBlocks.map(({ ev, block: b }) => (
                    <li key={b.key} className="absolute inset-x-1" style={{ top: b.top, height: b.height }}>
                      <button
                        type="button"
                        onClick={() => onSelectEvent?.(ev)}
                        aria-label={`${ev.title}, ${formatTimeRange(ev.start, ev.end)}${ev.room ? `, ${ev.room}` : ''}`}
                        title={`${ev.title}\n${formatTimeRange(ev.start, ev.end)}${ev.room ? `\n${ev.room}` : ''}`}
                        className={`block h-full w-full overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 ${eventStyle(ev).className}`}
                      >
                        <span className="block font-medium">{ev.title}</span>
                        {b.height >= 40 && <span className="block opacity-80">{formatTimeRange(ev.start, ev.end)}</span>}
                        {b.height >= 56 && ev.room && <span className="block truncate opacity-80">{ev.room}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
