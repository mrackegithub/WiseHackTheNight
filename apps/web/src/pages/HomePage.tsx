import { useAuth } from '../features/auth/auth-context';

export function HomePage() {
  const { me } = useAuth();
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Welcome{me ? `, ${me.displayName}` : ''}!</h1>
      <p className="max-w-md text-slate-600">
        Swipe on classmates who share your subjects and free time, then book a room together.
      </p>
    </section>
  );
}
