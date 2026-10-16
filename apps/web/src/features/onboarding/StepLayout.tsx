import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../components/form/Button';
import { FormError } from '../../components/form/FormError';

interface StepLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: () => void;
  onBack?: () => void;
  submitLabel?: string;
  saving?: boolean;
  error?: string | null;
}

/** Common frame for a wizard step: heading, body, and Back / Continue buttons. */
export function StepLayout({ title, description, children, onSubmit, onBack, submitLabel = 'Continue', saving, error }: StepLayoutProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <FormError message={error} />
      {children}
      <div className="flex justify-between gap-3 border-t border-slate-100 pt-4">
        {onBack ? (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
