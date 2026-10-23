import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { api } from '../api/client';
import { ApiError, unwrap } from '../api/errors';
import { Button } from '../components/form/Button';
import { FormError } from '../components/form/FormError';
import { TextField } from '../components/form/TextField';
import { AuthCard } from '../features/auth/AuthCard';
import { useAuth } from '../features/auth/auth-context';
import { validateLogin } from '../features/auth/validation';
import { config } from '../lib/config';
import { messageForError } from '../lib/error-messages';
import { usePageTitle } from '../hooks/usePageTitle';

export function LoginPage() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const mutation = useMutation({
    mutationFn: (body: Schemas['LoginRequest']) => unwrap(api.POST('/auth/login', { body })),
    meta: { silent: true },
    onSuccess: login, // GuestOnly then redirects to where the user was headed
  });

  const formError =
    mutation.error instanceof ApiError && mutation.error.status === 401
      ? 'Wrong email or password.'
      : mutation.error
        ? messageForError(mutation.error)
        : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors = validateLogin(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) mutation.mutate({ email: values.email.trim(), password: values.password });
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Find classmates to study with."
      footer={
        <>
          New here?{' '}
          {/* keeps where the user was headed (e.g. an invite link) through registration */}
          <Link to="/register" state={location.state} className="font-medium text-indigo-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={formError} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
          error={errors.password}
        />
        <Button type="submit" loading={mutation.isPending}>
          Log in
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() => {
            const demo = { email: 'demo@sgm.local', password: 'password123' };
            setValues(demo);
            setErrors({});
            mutation.mutate(demo);
          }}
        >
          Try demo account (demo@sgm.local)
        </Button>
        {config.useMocks && (
          <p className="text-center text-xs text-slate-500">
            Mock mode: <code>demo@sgm.local</code> / <code>password123</code>
          </p>
        )}
      </form>
    </AuthCard>
  );
}
