import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { meQuery } from '../features/auth/auth-context';
import { InterestsStep } from '../features/onboarding/steps/InterestsStep';
import { LocationStep } from '../features/onboarding/steps/LocationStep';
import { PreferencesStep } from '../features/onboarding/steps/PreferencesStep';
import { ProfileStep } from '../features/onboarding/steps/ProfileStep';
import { SubjectsStep } from '../features/onboarding/steps/SubjectsStep';
import type { StepProps } from '../features/onboarding/steps/types';
import { toast } from '../lib/toast';
import { usePageTitle } from '../hooks/usePageTitle';

const steps: { id: string; label: string; Component: (props: StepProps) => React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', Component: ProfileStep },
  { id: 'subjects', label: 'Subjects', Component: SubjectsStep },
  { id: 'interests', label: 'Interests', Component: InterestsStep },
  { id: 'preferences', label: 'Preferences', Component: PreferencesStep },
  { id: 'location', label: 'Location', Component: LocationStep },
];

export function OnboardingPage() {
  usePageTitle('Set up your profile');
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const index = Math.max(0, steps.findIndex((s) => s.id === params.get('step')));
  const step = steps[index];

  const goTo = (i: number) => setParams({ step: steps[i].id });

  async function finish() {
    // The server decides onboardingComplete (see docs/handoffs/fe-to-be-onboarding-complete.md).
    const me = await queryClient.fetchQuery({ ...meQuery, staleTime: 0 });
    if (!me.onboardingComplete) {
      toast.error('Almost there: add at least one subject and save your preferences.');
      return;
    }
    toast.success("You're all set! Start finding study partners.");
    navigate('/', { replace: true });
  }

  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Set up your profile</h1>
      <ol className="mt-4 flex gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.id} className="flex-1" aria-current={i === index ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= index ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            <span className={`mt-1 block text-xs ${i === index ? 'font-medium text-indigo-700' : 'text-slate-500'}`}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        Step {index + 1} of {steps.length}: {step.label}
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <step.Component
          key={step.id}
          onNext={() => (index === steps.length - 1 ? void finish() : goTo(index + 1))}
          onBack={index > 0 ? () => goTo(index - 1) : undefined}
        />
      </div>
    </section>
  );
}
