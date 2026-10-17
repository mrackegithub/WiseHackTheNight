import { Link } from 'react-router';
import studentsPhoto from '../assets/home-students.webp';
import { useAuth } from '../features/auth/auth-context';
import { usePageTitle } from '../hooks/usePageTitle';

export function HomePage() {
  usePageTitle('Home');
  const { me } = useAuth();
  return (
    <section className="relative isolate overflow-hidden rounded-2xl">
      {/* decorative: faded behind the text, blending into the page at the bottom */}
      <img src={studentsPhoto} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-50/30 via-slate-50/55 to-slate-50" />
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center sm:py-28">
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
