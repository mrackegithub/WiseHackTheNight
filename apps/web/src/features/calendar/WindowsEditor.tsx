import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { toast } from '../../lib/toast';
import { useAuth } from '../auth/auth-context';
import { calendarKeys } from './queries';
import { defaultWindows, readCachedWindows, validateWindows, WEEKDAYS, writeCachedWindows, type WeeklyWindow } from './windows';

type Row = WeeklyWindow & { key: number };

let nextKey = 1;
const withKeys = (windows: WeeklyWindow[]): Row[] => windows.map((w) => ({ ...w, key: nextKey++ }));
const withoutKeys = (rows: Row[]): WeeklyWindow[] => rows.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));

/** "Your study hours": the recurring weekly windows (PUT /me/availability). */
export function WindowsEditor() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<WeeklyWindow[]>(() => (me && readCachedWindows(me.id)) || defaultWindows());
  const [rows, setRows] = useState<Row[]>(() => withKeys(saved));
  const [submitted, setSubmitted] = useState(false);

  const errors = validateWindows(rows);
  const dirty = JSON.stringify(withoutKeys(rows)) !== JSON.stringify(saved);

  const save = useMutation({
    mutationFn: (body: WeeklyWindow[]) => unwrap(api.PUT('/me/availability', { body })),
    onSuccess: (windows) => {
      if (me) writeCachedWindows(me.id, windows);
      setSaved(windows);
      setRows(withKeys(windows));
      setSubmitted(false);
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success('Study hours saved. Your free slots are updated.');
    },
  });

  const update = (key: number, patch: Partial<WeeklyWindow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (weekday: number) => setRows([...rows, { key: nextKey++, weekday, startTime: '09:00', endTime: '17:00' }]);
  const remove = (key: number) => setRows(rows.filter((r) => r.key !== key));

  function copyMondayToWeekdays() {
    const monday = rows.filter((r) => r.weekday === 1);
    const others = rows.filter((r) => r.weekday > 5);
    const copies = [2, 3, 4, 5].flatMap((weekday) => monday.map((m) => ({ ...m, weekday, key: nextKey++ })));
    setRows([...monday, ...copies, ...others]);
  }

  function onSave() {
    setSubmitted(true);
    if (Object.keys(errors).length === 0) {
      save.mutate(withoutKeys(rows).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)));
    }
  }

  return (
    <section aria-labelledby="hours-heading" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 id="hours-heading" className="font-semibold">
        Your study hours
      </h2>
      <p className="mt-1 text-sm text-slate-600">When are you willing to study at all? Free slots are these hours minus your classes.</p>

      <ul className="mt-4 flex flex-col divide-y divide-slate-100">
        {WEEKDAYS.map(({ day, short, long }) => {
          const dayRows = rows.filter((r) => r.weekday === day);
          return (
            <li key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-2">
              <span className="w-10 pt-1.5 text-sm font-medium" aria-hidden>
                {short}
              </span>
              <div className="flex flex-1 flex-col gap-2" role="group" aria-label={`${long} hours`}>
                {dayRows.length === 0 && <span className="pt-1.5 text-sm text-slate-500">Not available</span>}
                {dayRows.map((r, i) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <input
                      type="time"
                      step={900}
                      value={r.startTime}
                      onChange={(e) => update(r.key, { startTime: e.target.value })}
                      aria-label={`${long} range ${i + 1} start`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <span aria-hidden>–</span>
                    <input
                      type="time"
                      step={900}
                      value={r.endTime}
                      onChange={(e) => update(r.key, { endTime: e.target.value })}
                      aria-label={`${long} range ${i + 1} end`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      aria-label={`Remove ${long} range ${i + 1}`}
                      className="rounded px-2 text-lg leading-none text-slate-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {submitted && errors[day] && (
                  <p role="alert" className="text-xs text-red-600">
                    {errors[day]}
                  </p>
                )}
              </div>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => add(day)} aria-label={`Add hours on ${long}`}>
                + Add
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={copyMondayToWeekdays}>
          Copy Monday to Tue–Fri
        </Button>
        <Button variant="ghost" onClick={() => setRows(withKeys(saved))} disabled={!dirty}>
          Reset
        </Button>
        <Button onClick={onSave} loading={save.isPending} disabled={!dirty}>
          Save hours
        </Button>
      </div>
    </section>
  );
}
