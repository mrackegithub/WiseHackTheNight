import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { RangeField } from '../../../components/form/RangeField';
import { Spinner } from '../../../components/Spinner';
import { messageForError } from '../../../lib/error-messages';
import { formatMinutes, locationTypeLabels, modeLabels } from '../../../lib/labels';
import { profileKeys, useMyPreferences } from '../../profile/queries';
import { StepLayout } from '../StepLayout';
import type { StepProps } from './types';

type Preferences = Schemas['Preferences'];

export function PreferencesStep(props: StepProps) {
  const prefs = useMyPreferences();
  if (prefs.isPending) return <Spinner label="Loading your preferences" />;
  return <PreferencesEditor {...props} initial={prefs.data!} />;
}

function PreferencesEditor({ onNext, onBack, initial }: StepProps & { initial: Preferences }) {
  const queryClient = useQueryClient();
  const [p, setP] = useState(initial);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: (body: Preferences) => unwrap(api.PUT('/me/preferences', { body })),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(profileKeys.preferences, saved);
      onNext();
    },
  });

  const inPerson = p.mode !== 'ONLINE';

  function toggleType(type: Schemas['LocationType']) {
    set('locationTypes', p.locationTypes.includes(type) ? p.locationTypes.filter((t) => t !== type) : [...p.locationTypes, type]);
  }

  return (
    <StepLayout
      title="How you like to study"
      description="We only suggest groups and places that fit these."
      onSubmit={() => save.mutate(p)}
      onBack={onBack}
      saving={save.isPending}
      error={save.error ? messageForError(save.error) : null}
    >
      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Where?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(Object.keys(modeLabels) as Preferences['mode'][]).map((mode) => (
            <label
              key={mode}
              className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm has-focus-visible:ring-2 has-focus-visible:ring-indigo-300 ${
                p.mode === mode ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700' : 'border-slate-300 text-slate-700'
              }`}
            >
              <input type="radio" name="mode" className="sr-only" checked={p.mode === mode} onChange={() => set('mode', mode)} />
              {modeLabels[mode]}
            </label>
          ))}
        </div>
      </fieldset>

      <RangeField
        label="Smallest group"
        min={2}
        max={10}
        value={p.groupSizeMin}
        display={`${p.groupSizeMin} people`}
        onChange={(v) => setP((prev) => ({ ...prev, groupSizeMin: v, groupSizeMax: Math.max(v, prev.groupSizeMax) }))}
      />
      <RangeField
        label="Largest group"
        min={2}
        max={10}
        value={p.groupSizeMax}
        display={`${p.groupSizeMax} people`}
        onChange={(v) => setP((prev) => ({ ...prev, groupSizeMax: v, groupSizeMin: Math.min(v, prev.groupSizeMin) }))}
      />
      <RangeField
        label="Session length"
        min={30}
        max={240}
        step={15}
        value={p.sessionLengthMinutes}
        display={formatMinutes(p.sessionLengthMinutes)}
        onChange={(v) => set('sessionLengthMinutes', v)}
      />

      {inPerson && (
        <>
          <RangeField
            label="Max distance from home"
            min={0.5}
            max={50}
            step={0.5}
            value={p.maxDistanceKm}
            display={`${p.maxDistanceKm} km`}
            onChange={(v) => set('maxDistanceKm', v)}
          />
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Places you like</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {(Object.keys(locationTypeLabels) as Schemas['LocationType'][]).map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="accent-indigo-600" checked={p.locationTypes.includes(type)} onChange={() => toggleType(type)} />
                  {locationTypeLabels[type]}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </StepLayout>
  );
}
