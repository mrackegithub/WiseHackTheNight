import type { Schemas } from '@sgm/contracts';
import { Spinner } from '../../components/Spinner';
import { formatMinutes } from '../../lib/labels';
import { formatSlot, minutesBetween } from '../../lib/time';
import { useSuggestedSlots } from './queries';

interface SuggestedSlotsProps {
  group: Schemas['Group'];
  /** Rendered next to each slot, e.g. a "Schedule" button (A8). */
  action?: (slot: Schemas['SuggestedSlot']) => React.ReactNode;
}

export function SuggestedSlots({ group, action }: SuggestedSlotsProps) {
  const slots = useSuggestedSlots(group.id);
  const names = new Map(group.members.map((m) => [m.user.id, m.user.displayName]));

  return (
    <section aria-labelledby="slots-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="slots-heading" className="font-semibold">
        Suggested times
      </h2>
      <p className="text-sm text-slate-600">When most of you are free in the next 7 days, best first.</p>
      {slots.isPending ? (
        <Spinner label="Finding common free time" />
      ) : slots.data?.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {slots.data.slice(0, 5).map((s) => {
            const everyone = s.availableMemberIds.length === group.members.length;
            const missing = group.members.filter((m) => !s.availableMemberIds.includes(m.user.id)).map((m) => names.get(m.user.id));
            return (
              <li key={s.start} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{formatSlot(s.start, s.end)}</p>
                  <p className={`text-xs ${everyone ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {everyone ? 'Everyone is free' : `${s.availableMemberIds.length} of ${group.members.length} free · not ${missing.join(', ')}`} ·{' '}
                    {formatMinutes(minutesBetween(s.start, s.end))}
                  </p>
                </div>
                {action?.(s)}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No common free time in the next 7 days. Check your study hours on the Calendar page.</p>
      )}
    </section>
  );
}
