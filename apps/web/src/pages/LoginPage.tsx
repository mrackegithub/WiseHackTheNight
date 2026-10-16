import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router';
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

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const mutation = useMutation({
    mutationFn: (body: Schemas['LoginRequest']) => unwrap(api.POST('/auth/login', { body })),
    meta: { silent: true },
    onSuccess: (tokens) => {
      login(tokens);
      navigate(from, { replace: true });
    },
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
          <Link to="/register" className="font-medium text-indigo-700 hover:underline">
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
        {config.useMocks && (
          <p className="text-center text-xs text-slate-500">
            Mock mode: <code>demo@sgm.local</code> / <code>password123</code>
          </p>
        )}
      </form>
    </AuthCard>
  );
}
