import { Link } from 'react-router';
import { QueryError } from '../components/QueryError';
import { Spinner } from '../components/Spinner';
import { useMyGroups } from '../features/groups/queries';
import { formatSlot, inZone } from '../lib/time';
import { usePageTitle } from '../hooks/usePageTitle';

export function GroupsPage() {
  usePageTitle('My groups');
  const groups = useMyGroups();

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">My groups</h1>
      {groups.isPending ? (
        <Spinner label="Loading your groups" />
      ) : groups.isError ? (
        <QueryError what="your groups" error={groups.error} onRetry={() => void groups.refetch()} />
      ) : groups.data.length ? (
        <ul className="flex flex-col gap-3">
          {groups.data.map((g) => (
            <li key={g.id}>
              <Link
                to={`/groups/${g.id}`}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{g.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {g.memberCount}/{g.maxSize} members
                  </span>
                </span>
                <span className="text-sm text-slate-600">{g.subject.name}</span>
                <span className={`text-sm ${g.nextSessionAt ? 'text-indigo-700' : 'text-slate-500'}`}>
                  {g.nextSessionAt ? `Next: ${formatSlot(g.nextSessionAt, g.nextSessionAt).split(' · ')[0]}, ${inZone(g.nextSessionAt).toFormat('HH:mm')}` : 'No session planned'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium">No groups yet</p>
          <p className="mt-1 text-sm text-slate-600">Like classmates or join an open group to get started.</p>
          <Link to="/discover" className="mt-3 inline-block font-medium text-indigo-700 hover:underline">
            Go to Discover
          </Link>
        </div>
      )}
    </section>
  );
}
