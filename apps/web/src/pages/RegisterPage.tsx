import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { api } from '../api/client';
import { ApiError, unwrap } from '../api/errors';
import { Button } from '../components/form/Button';
import { FormError } from '../components/form/FormError';
import { TextField } from '../components/form/TextField';
import { AuthCard } from '../features/auth/AuthCard';
import { useAuth } from '../features/auth/auth-context';
import { validateRegister, type RegisterValues } from '../features/auth/validation';
import { messageForError } from '../lib/error-messages';
import { fieldErrors } from '../lib/field-errors';

export function RegisterPage() {
  const { login } = useAuth();
  const [values, setValues] = useState<RegisterValues>({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterValues, string>>>({});

  const mutation = useMutation({
    mutationFn: (body: Schemas['RegisterRequest']) => unwrap(api.POST('/auth/register', { body })),
    meta: { silent: true },
    onSuccess: login, // GuestOnly then redirects to /onboarding
    onError: (error) => setErrors(fieldErrors(error)),
  });

  const formError =
    mutation.error instanceof ApiError && mutation.error.status === 409
      ? 'An account with this email already exists.'
      : mutation.error && !(mutation.error instanceof ApiError && mutation.error.code === 'VALIDATION_FAILED')
        ? messageForError(mutation.error)
        : null;

  const set = (field: keyof RegisterValues) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateRegister(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      mutation.mutate({ displayName: values.displayName.trim(), email: values.email.trim(), password: values.password });
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="It takes a minute. You'll set up subjects and your schedule next."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField label="Name" autoComplete="name" value={values.displayName} onChange={set('displayName')} error={errors.displayName} />
        <TextField label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters."
        />
        <Button type="submit" loading={mutation.isPending}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
