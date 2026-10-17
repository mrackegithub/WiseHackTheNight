import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { ApiError, unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';
import { TextField } from '../../components/form/TextField';
import { Modal } from '../../components/Modal';
import { messageForError } from '../../lib/error-messages';
import { fieldErrors } from '../../lib/field-errors';
import { nowInZone, toApiTime, ZONE } from '../../lib/time';
import { toast } from '../../lib/toast';
import { calendarKeys } from './queries';

/** repeatWeeks = extra weekly copies, so "4 weeks" = 3. */
const repeatOptions = [
  { value: 0, label: "Doesn't repeat" },
  { value: 3, label: 'Every week for 4 weeks' },
  { value: 7, label: 'Every week for 8 weeks' },
  { value: 11, label: 'Every week for 12 weeks' },
  { value: 15, label: 'Every week for 16 weeks (semester)' },
];

interface Props {
  /** Pre-filled date (Budapest), e.g. a day of the week being viewed. */
  defaultDate: DateTime;
  onClose: () => void;
}

/** Add a busy block that isn't in Neptun (job, sport, a course without a feed): POST /me/schedule. */
export function BusyTimeModal({ defaultDate, onClose }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({ title: '', date: defaultDate.toISODate()!, start: '18:00', end: '19:30', repeatWeeks: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: Schemas['ManualEventInput']) => unwrap(api.POST('/me/schedule', { body })),
    meta: { silent: true },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success(created.length > 1 ? `Added "${created[0].title}" for ${created.length} weeks.` : `Added "${created[0].title}".`);
      onClose();
    },
    onError: (err) => setErrors(fieldErrors(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const start = DateTime.fromISO(`${values.date}T${values.start}`, { zone: ZONE });
    const end = DateTime.fromISO(`${values.date}T${values.end}`, { zone: ZONE });
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = 'Give it a short name, e.g. "Part-time job".';
    if (!start.isValid || !end.isValid) next.date = 'Pick a date and times.';
    else if (end <= start) next.end = 'End must be after start.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({ title: values.title.trim(), start: toApiTime(start), end: toApiTime(end), repeatWeeks: values.repeatWeeks });
  }

  const set = (field: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues({ ...values, [field]: field === 'repeatWeeks' ? Number(e.target.value) : e.target.value });

  const serverError = save.error && !(save.error instanceof ApiError && save.error.code === 'VALIDATION_FAILED') ? messageForError(save.error) : null;

  return (
    <Modal title="Add busy time" onClose={onClose} size="md" description="Block time that isn't in Neptun. You won't be matched or scheduled then.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={serverError} />
        <TextField label="What is it?" placeholder="e.g. Part-time job, football training" value={values.title} onChange={set('title')} error={errors.title} data-autofocus />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Date" type="date" value={values.date} min={nowInZone().toISODate()!} onChange={set('date')} error={errors.date ?? errors.start} />
          <TextField label="From" type="time" step={900} value={values.start} onChange={set('start')} />
          <TextField label="To" type="time" step={900} value={values.end} onChange={set('end')} error={errors.end} />
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Repeat
          <select value={values.repeatWeeks} onChange={set('repeatWeeks')} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            {repeatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Add busy time
          </Button>
        </div>
      </form>
    </Modal>
  );
}
