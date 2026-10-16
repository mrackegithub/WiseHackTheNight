import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { Button } from '../../../components/form/Button';
import { Spinner } from '../../../components/Spinner';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { messageForError } from '../../../lib/error-messages';
import { roleLabels, roleOrder } from '../../../lib/labels';
import { profileKeys, useMySubjects, useSubjectSearch } from '../../profile/queries';
import { StepLayout } from '../StepLayout';
import type { StepProps } from './types';

const MAX_SUBJECTS = 30;

export function SubjectsStep(props: StepProps) {
  const mine = useMySubjects();
  if (mine.isPending) return <Spinner label="Loading your subjects" />;
  return <SubjectsEditor {...props} initial={mine.data ?? []} />;
}

function SubjectsEditor({ onNext, onBack, initial }: StepProps & { initial: Schemas['UserSubject'][] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = useSubjectSearch(useDebouncedValue(query.trim()));

  const save = useMutation({
    mutationFn: (body: Schemas['UserSubjectInput'][]) => unwrap(api.PUT('/me/subjects', { body })),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData(profileKeys.subjects, saved);
      onNext();
    },
  });

  const selectedIds = new Set(selected.map((s) => s.subject.id));
  const results = (search.data?.items ?? []).filter((s) => !selectedIds.has(s.id));

  function add(subject: Schemas['Subject']) {
    if (selected.length >= MAX_SUBJECTS) return setError(`You can add up to ${MAX_SUBJECTS} subjects.`);
    setError(null);
    setSelected([...selected, { subject, role: 'PEER', confidence: 3 }]);
  }

  const update = (id: string, patch: Partial<Schemas['UserSubject']>) =>
    setSelected(selected.map((s) => (s.subject.id === id ? { ...s, ...patch } : s)));

  function submit() {
    if (selected.length === 0) return setError('Add at least one subject you want to study.');
    save.mutate(selected.map((s) => ({ subjectId: s.subject.id, role: s.role, confidence: s.confidence })));
  }

  return (
    <StepLayout
      title="Your subjects"
      description="Pick the courses you want study partners for, and how you'd like to study each one."
      onSubmit={submit}
      onBack={onBack}
      saving={save.isPending}
      error={error ?? (save.error ? messageForError(save.error) : null)}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="subject-search" className="text-sm font-medium text-slate-700">
          Search by name or Neptun code
        </label>
        <input
          id="subject-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Algorithms or IP-18AA1E"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <ul aria-label="Search results" className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {results.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>
                {s.name} <span className="text-xs text-slate-500">{s.code}</span>
              </span>
              <Button variant="secondary" className="px-3 py-1" onClick={() => add(s)} aria-label={`Add ${s.name}`}>
                Add
              </Button>
            </li>
          ))}
          {!search.isPending && results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No matching subjects.</li>}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-700">Selected ({selected.length})</h3>
        {selected.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nothing yet. Search above and add your courses.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {selected.map((s) => (
              <li key={s.subject.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {s.subject.name} <span className="text-xs font-normal text-slate-500">{s.subject.code}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelected(selected.filter((x) => x.subject.id !== s.subject.id))}
                    className="text-xs text-slate-500 hover:text-red-600"
                    aria-label={`Remove ${s.subject.name}`}
                  >
                    Remove
                  </button>
                </div>
                <fieldset className="mt-2">
                  <legend className="sr-only">How do you want to study {s.subject.name}?</legend>
                  <div className="flex flex-wrap gap-2">
                    {roleOrder.map((role) => (
                      <label
                        key={role}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs has-focus-visible:ring-2 has-focus-visible:ring-indigo-300 ${
                          s.role === role ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`role-${s.subject.id}`}
                          checked={s.role === role}
                          onChange={() => update(s.subject.id, { role })}
                        />
                        {roleLabels[role]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  Confidence
                  <select
                    value={s.confidence}
                    onChange={(e) => update(s.subject.id, { confidence: Number(e.target.value) })}
                    className="rounded border border-slate-300 px-1 py-0.5"
                    aria-label={`Confidence in ${s.subject.name}`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StepLayout>
  );
}
