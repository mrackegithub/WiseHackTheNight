import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { TextField } from '../../../components/form/TextField';
import { messageForError } from '../../../lib/error-messages';
import { fieldErrors } from '../../../lib/field-errors';
import { meQueryKey, useAuth } from '../../auth/auth-context';
import { StepLayout } from '../StepLayout';
import type { StepProps } from './types';

const BIO_MAX = 300;

export function ProfileStep({ onNext, onBack }: StepProps) {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    displayName: me?.displayName ?? '',
    university: me?.university ?? '',
    faculty: me?.faculty ?? '',
    bio: me?.bio ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: Schemas['UpdateMeRequest']) => unwrap(api.PATCH('/me', { body })),
    meta: { silent: true },
    onSuccess: (updated) => {
      queryClient.setQueryData(meQueryKey, updated);
      onNext();
    },
    onError: (error) => setErrors(fieldErrors(error)),
  });

  function submit() {
    const name = values.displayName.trim();
    const next: Record<string, string> = {};
    if (name.length < 2 || name.length > 50) next.displayName = 'Name must be 2–50 characters.';
    if (values.bio.length > BIO_MAX) next.bio = `Keep it under ${BIO_MAX} characters.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    const orNull = (s: string) => s.trim() || null;
    save.mutate({ displayName: name, university: orNull(values.university), faculty: orNull(values.faculty), bio: orNull(values.bio) });
  }

  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value });

  return (
    <StepLayout
      title="About you"
      description="This is what classmates see on your card."
      onSubmit={submit}
      onBack={onBack}
      saving={save.isPending}
      error={save.error && !Object.keys(fieldErrors(save.error)).length ? messageForError(save.error) : null}
    >
      <TextField label="Name" value={values.displayName} onChange={set('displayName')} error={errors.displayName} autoComplete="name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="University" value={values.university} onChange={set('university')} placeholder="e.g. ELTE" />
        <TextField label="Faculty" value={values.faculty} onChange={set('faculty')} placeholder="e.g. Faculty of Informatics" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="bio" className="text-sm font-medium text-slate-700">
          Short bio <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          rows={3}
          value={values.bio}
          onChange={set('bio')}
          aria-invalid={errors.bio ? true : undefined}
          aria-describedby="bio-count"
          placeholder="What are you studying, how do you like to learn?"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <p id="bio-count" className={`text-xs ${values.bio.length > BIO_MAX ? 'text-red-600' : 'text-slate-500'}`}>
          {errors.bio ?? `${values.bio.length}/${BIO_MAX}`}
        </p>
      </div>
    </StepLayout>
  );
}
