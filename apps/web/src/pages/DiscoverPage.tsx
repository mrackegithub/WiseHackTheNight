import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Schemas } from '@sgm/contracts';
import { QueryError } from '../components/QueryError';
import { Spinner } from '../components/Spinner';
import { MatchModal } from '../features/matching/MatchModal';
import type { CandidateKind } from '../features/matching/queries';
import { SwipeDeck } from '../features/matching/SwipeDeck';
import { useMySubjects } from '../features/profile/queries';
import { roleLabels } from '../lib/labels';

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const mySubjects = useMySubjects();
  const kind: CandidateKind = params.get('kind') === 'group' ? 'group' : 'user';

  const subjects = mySubjects.data ?? [];
  const selected = subjects.find((s) => s.subject.id === params.get('subject')) ?? subjects[0];

  const set = (patch: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...patch }, { replace: true });

  const [matched, setMatched] = useState<{ match: Schemas['Match']; candidate: Schemas['Candidate'] } | null>(null);
  const onMatch = useCallback((match: Schemas['Match'], candidate: Schemas['Candidate']) => setMatched({ match, candidate }), []);
  const closeMatch = useCallback(() => setMatched(null), []);

  if (mySubjects.isPending) return <Spinner label="Loading your subjects" />;
  if (mySubjects.isError) return <QueryError what="your subjects" error={mySubjects.error} onRetry={() => void mySubjects.refetch()} />;

  if (!selected) {
    return (
      <section className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="mt-2 text-slate-600">Add the subjects you're studying to start finding partners.</p>
        <Link to="/onboarding?step=subjects" className="mt-4 inline-block font-medium text-indigo-700 hover:underline">
          Add subjects
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Discover</h1>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        Subject
        <select
          value={selected.subject.id}
          onChange={(e) => set({ subject: e.target.value })}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal shadow-sm"
        >
          {subjects.map((s) => (
            <option key={s.subject.id} value={s.subject.id}>
              {s.subject.name} ({roleLabels[s.role]})
            </option>
          ))}
        </select>
      </label>

      <div role="radiogroup" aria-label="Show" className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
        {(['user', 'group'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => set({ kind: k })}
            className={`rounded-md py-1.5 ${kind === k ? 'bg-white font-medium shadow-sm' : 'text-slate-600'}`}
          >
            {k === 'user' ? 'People' : 'Open groups'}
          </button>
        ))}
      </div>

      <SwipeDeck key={`${selected.subject.id}-${kind}`} subjectId={selected.subject.id} kind={kind} onMatch={onMatch} />
      {matched && <MatchModal match={matched.match} candidate={matched.candidate} onClose={closeMatch} />}
    </section>
  );
}
