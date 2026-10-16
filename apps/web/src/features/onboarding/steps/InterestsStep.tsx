import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { QueryError } from '../../../components/QueryError';
import { Spinner } from '../../../components/Spinner';
import { messageForError } from '../../../lib/error-messages';
import { meQueryKey, useAuth } from '../../auth/auth-context';
import { useInterests } from '../../profile/queries';
import { StepLayout } from '../StepLayout';
import type { StepProps } from './types';

const MAX_INTERESTS = 15;

export function InterestsStep({ onNext, onBack }: StepProps) {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const catalogue = useInterests();
  const [selected, setSelected] = useState(() => new Set(me?.interests?.map((i) => i.id) ?? []));

  const save = useMutation({
    mutationFn: (body: Schemas['UpdateMeRequest']) => unwrap(api.PATCH('/me', { body })),
    meta: { silent: true },
    onSuccess: (updated) => {
      queryClient.setQueryData(meQueryKey, updated);
      onNext();
    },
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_INTERESTS) next.add(id);
    setSelected(next);
  }

  return (
    <StepLayout
      title="Your interests"
      description={`Optional: pick up to ${MAX_INTERESTS}. Shared interests help rank your matches.`}
      onSubmit={() => save.mutate({ interestIds: [...selected] })}
      onBack={onBack}
      saving={save.isPending}
      error={save.error ? messageForError(save.error) : null}
    >
      {catalogue.isPending ? (
        <Spinner label="Loading interests" />
      ) : catalogue.isError ? (
        <QueryError compact what="the interests" error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
          {catalogue.data?.map((interest) => {
            const on = selected.has(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                aria-pressed={on}
                disabled={!on && selected.size >= MAX_INTERESTS}
                onClick={() => toggle(interest.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                  on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {interest.label}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">
        {selected.size}/{MAX_INTERESTS} selected
      </p>
    </StepLayout>
  );
}
