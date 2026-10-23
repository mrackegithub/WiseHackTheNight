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
import { categoryOptions, type EventCategory } from './event-style';
import { calendarKeys } from './queries';

/** repeatWeeks = extra weekly copies, so "4 weeks" = 3. */
const repeatOptions = [
  { value: 0, label: "Doesn't repeat" },
  { value: 1, label: 'Every week for 2 weeks' },
  { value: 2, label: 'Every week for 3 weeks' },
  { value: 3, label: 'Every week for 4 weeks' },
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
  const [category, setCategory] = useState<EventCategory>('OTHER');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (body: Schemas['ManualEventInput']) => unwrap(api.POST('/me/schedule', { body })),
    meta: { silent: true },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success(created.length > 1 ? `Added "${created[0].title}" for ${created.length} weeks.` : `Added "${created[0].title}".`);
      onClose();
    },
    onError: (err) => {
      if (
        (err instanceof ApiError && (err.status === 409 || err.code === 'EVENT_CONFLICT')) ||
        (err && typeof err === 'object' && ('status' in err && (err as { status: number }).status === 409 || 'code' in err && (err as { code: string }).code === 'EVENT_CONFLICT'))
      ) {
        setFormError((err as { message?: string }).message || 'You already have an event scheduled during this time.');
      }
      setErrors(fieldErrors(err));
    },
  });
  const save = mutation;

  const startTime = DateTime.fromISO(`${values.date}T${values.start}`, { zone: ZONE });
  const endTime = DateTime.fromISO(`${values.date}T${values.end}`, { zone: ZONE });
  const isOvernight = startTime.isValid && endTime.isValid && endTime < startTime;

  function submit(e: FormEvent) {
    e.preventDefault();
    const start = DateTime.fromISO(`${values.date}T${values.start}`, { zone: ZONE });
    let end = DateTime.fromISO(`${values.date}T${values.end}`, { zone: ZONE });
    const next: Record<string, string> = {};
    if (!values.title.trim()) next.title = 'Give it a short name, e.g. "Part-time job".';
    if (!start.isValid || !end.isValid) {
      next.date = 'Pick a date and times.';
    } else if (end.toMillis() === start.toMillis()) {
      next.end = 'End must be after start.';
    } else {
      if (end < start) {
        end = end.plus({ days: 1 });
      }
      const durationHours = end.diff(start, 'hours').hours;
      if (durationHours <= 0 || durationHours > 24) {
        next.end = 'End must be after start.';
      }
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setFormError(null);
    mutation.mutate(
      { title: values.title.trim(), start: toApiTime(start), end: toApiTime(end), repeatWeeks: values.repeatWeeks, category },
      {
        onError: (err) => {
          if (
            (err instanceof ApiError && (err.status === 409 || err.code === 'EVENT_CONFLICT')) ||
            (err && typeof err === 'object' && ('status' in err && (err as { status: number }).status === 409 || 'code' in err && (err as { code: string }).code === 'EVENT_CONFLICT'))
          ) {
            setFormError((err as { message?: string }).message || 'You already have an event scheduled during this time.');
          }
        },
      },
    );
  }

  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => {
    setFormError(null);
    setValues({ ...values, [field]: field === 'repeatWeeks' ? Number(e.target.value) : e.target.value });
  };

  const serverError =
    formError ??
    (mutation.error && !(mutation.error instanceof ApiError && mutation.error.code === 'VALIDATION_FAILED')
      ? messageForError(mutation.error)
      : null);

  return (
    <Modal title="Add busy time" onClose={onClose} size="md" description="Block time that isn't in Neptun. You won't be matched or scheduled then.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={formError || serverError} />
        <TextField label="What is it?" placeholder="e.g. Part-time job, football training" value={values.title} onChange={set('title')} error={errors.title} data-autofocus />
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Type</legend>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categoryOptions.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-indigo-600 ${
                  category === o.value ? 'border-slate-900 bg-slate-50 font-medium' : 'border-slate-300'
                }`}
              >
                <input type="radio" name="category" value={o.value} checked={category === o.value} onChange={() => setCategory(o.value)} className="sr-only" />
                <span className={`h-3 w-3 shrink-0 rounded ${o.swatch}`} aria-hidden />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Date" type="date" value={values.date} min={nowInZone().toISODate()!} onChange={set('date')} error={errors.date ?? errors.start} />
          <TextField label="From" type="time" step={900} value={values.start} onChange={set('start')} />
          <TextField label="To" type="time" step={900} value={values.end} onChange={set('end')} error={errors.end} hint={isOvernight ? 'Ends next day' : undefined} />
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
