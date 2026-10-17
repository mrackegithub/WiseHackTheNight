import { Link } from 'react-router';
import studentsPhoto from '../assets/home-students.webp';
import { useAuth } from '../features/auth/auth-context';
import { usePageTitle } from '../hooks/usePageTitle';

export function HomePage() {
  usePageTitle('Home');
  const { me } = useAuth();
  return (
    <section className="relative isolate flex min-h-[38rem] items-end justify-center overflow-hidden rounded-2xl p-4 sm:aspect-[3/2] sm:min-h-0 sm:p-8">
      {/* decorative: the whole photo (3:2) behind the welcome, softened only towards the bottom where the text sits */}
      <img src={studentsPhoto} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-90" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent from-50% to-slate-50/80" />
      <div className="flex max-w-lg flex-col items-center gap-3 rounded-2xl bg-white/80 px-6 py-6 text-center shadow-lg backdrop-blur-sm sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight">Welcome{me ? `, ${me.displayName}` : ''}!</h1>
        <p className="max-w-md font-medium text-slate-700">
          Swipe on classmates who share your subjects and free time, then book a room together.
        </p>
        <Link to="/discover" className="mt-2 rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-indigo-700">
          Start swiping
        </Link>
      </div>
    </section>
  );
}
