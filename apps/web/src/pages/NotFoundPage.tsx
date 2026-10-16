import { Link } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-indigo-700 hover:underline">
        Back home
      </Link>
    </section>
  );
}
