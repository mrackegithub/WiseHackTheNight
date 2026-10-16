import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../api/client';
import { ApiError, unwrap } from '../../api/errors';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { messageForError } from '../../lib/error-messages';
import { formatMinutes, locationTypeLabels } from '../../lib/labels';
import { formatSlot, formatTime } from '../../lib/time';
import { toast } from '../../lib/toast';
import { calendarKeys } from '../calendar/queries';
import { groupKeys, useSuggestedLocations } from '../groups/queries';
import { useMyPreferences } from '../profile/queries';
import { addMinutes, defaultDuration, durationOptions, startOptions } from './time-options';

type Place = { kind: 'location'; location: Schemas['Location'] } | { kind: 'online' } | { kind: 'later' };
type Step = 'when' | 'where' | 'confirm';

interface Props {
  group: Schemas['Group'];
  slot: Schemas['SuggestedSlot'];
  onClose: () => void;
}

const URL_RE = /^https?:\/\/\S+$/i;

export function ScheduleSessionModal({ group, slot, onClose }: Props) {
  const queryClient = useQueryClient();
  const preferred = useMyPreferences().data?.sessionLengthMinutes ?? 90;
  const places = useSuggestedLocations(group.id, null, 5);

  const starts = startOptions(slot);
  const [step, setStep] = useState<Step>('when');
  const [start, setStart] = useState(starts[0]);
  const durations = durationOptions(slot.end, start);
  const [duration, setDuration] = useState(() => defaultDuration(durationOptions(slot.end, starts[0]), preferred));
  const [place, setPlace] = useState<Place>({ kind: 'later' });
  const [onlineUrl, setOnlineUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const end = addMinutes(start, duration);

  const create = useMutation({
    mutationFn: (body: Schemas['CreateSessionRequest']) => unwrap(api.POST('/groups/{groupId}/sessions', { params: { path: { groupId: group.id } }, body })),
    meta: { silent: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupKeys.all });
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success(`Session scheduled for ${formatSlot(start, end)}.`);
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError && err.status === 409 ? 'Someone in the group is busy at that time. Pick another time.' : messageForError(err)),
  });

  function changeStart(next: string) {
    setStart(next);
    const fits = durationOptions(slot.end, next);
    if (!fits.includes(duration)) setDuration(defaultDuration(fits, preferred));
  }

  function nextFromWhere() {
    if (place.kind === 'online' && !URL_RE.test(onlineUrl.trim())) return setError('Paste the meeting link (https://…).');
    setError(null);
    setStep('confirm');
  }

  function submit() {
    setError(null);
    create.mutate({
      start,
      end,
      ...(place.kind === 'location' ? { locationId: place.location.id } : {}),
      ...(place.kind === 'online' ? { onlineUrl: onlineUrl.trim() } : {}),
    });
  }

  const whereText = place.kind === 'location' ? place.location.name : place.kind === 'online' ? 'Online' : 'Not decided yet';

  return (
    <Modal title="Schedule a session" onClose={onClose} size="md" description={`${group.name} · ${group.subject.name}`}>
      <ol className="mb-4 flex gap-2 text-xs" aria-label="Steps">
        {(['when', 'where', 'confirm'] as const).map((s, i) => (
          <li key={s} aria-current={s === step ? 'step' : undefined} className={`flex-1 border-t-4 pt-1 ${s === step ? 'border-indigo-600 font-medium text-indigo-700' : 'border-slate-200 text-slate-500'}`}>
            {i + 1}. {s === 'when' ? 'When' : s === 'where' ? 'Where' : 'Confirm'}
          </li>
        ))}
      </ol>

      <FormError message={error} />

      {step === 'when' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Free window: <strong>{formatSlot(slot.start, slot.end)}</strong>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Start
              <select value={start} onChange={(e) => changeStart(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 font-normal">
                {starts.map((s) => (
                  <option key={s} value={s}>
                    {formatTime(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Length
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-2 font-normal">
                {durations.map((d) => (
                  <option key={d} value={d}>
                    {formatMinutes(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button data-autofocus onClick={() => setStep('where')}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 'where' && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">Where will you meet?</legend>
          {places.isPending && <Spinner label="Loading places" />}
          {places.data?.map((s) => (
            <label key={s.location.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50">
              <input
                type="radio"
                name="place"
                className="mt-1 accent-indigo-600"
                checked={place.kind === 'location' && place.location.id === s.location.id}
                onChange={() => setPlace({ kind: 'location', location: s.location })}
              />
              <span className="text-sm">
                <span className="font-medium">{s.location.name}</span>
                {s.location.bookable && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Bookable</span>}
                <span className="block text-xs text-slate-500">
                  {locationTypeLabels[s.location.type]} · at most {s.maxMemberDistanceKm} km for anyone
                </span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50">
            <input type="radio" name="place" className="mt-1 accent-indigo-600" checked={place.kind === 'online'} onChange={() => setPlace({ kind: 'online' })} />
            <span className="flex-1 text-sm">
              <span className="font-medium">Online</span>
              {place.kind === 'online' && (
                <input
                  type="url"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  placeholder="https://meet…"
                  aria-label="Meeting link"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              )}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50">
            <input type="radio" name="place" className="mt-1 accent-indigo-600" checked={place.kind === 'later'} onChange={() => setPlace({ kind: 'later' })} />
            <span className="text-sm font-medium">Decide later</span>
          </label>
          <div className="mt-2 flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep('when')}>
              Back
            </Button>
            <Button onClick={nextFromWhere}>Next</Button>
          </div>
        </fieldset>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">When</dt>
            <dd className="font-medium">{formatSlot(start, end)}</dd>
            <dt className="text-slate-500">Where</dt>
            <dd className="font-medium">{whereText}</dd>
          </dl>
          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep('where')}>
              Back
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Schedule session
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
