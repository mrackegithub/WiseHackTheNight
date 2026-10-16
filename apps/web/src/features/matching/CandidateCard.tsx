import type { Schemas } from '@sgm/contracts';
import { formatSlot } from '../../lib/time';
import { initials, matchSummary, theirRole } from './card-helpers';
import { ScoreBreakdown } from './ScoreBreakdown';

export function CandidateCard({ candidate: c }: { candidate: Schemas['Candidate'] }) {
  const title = c.kind === 'group' ? (c.group?.name ?? 'Study group') : (c.user?.displayName ?? 'Classmate');
  const role = c.role ? theirRole[c.role] : null;

  return (
    <article aria-label={title} className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
      <header className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700" aria-hidden>
          {c.kind === 'group' ? '👥' : initials(title)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{title}</h2>
          <p className="text-sm text-slate-600">
            {c.kind === 'group' && c.group
              ? `${c.group.memberCount}/${c.group.maxSize} members`
              : [c.user?.faculty, c.distanceKm != null ? `${c.distanceKm} km away` : null].filter(Boolean).join(' · ')}
          </p>
          {role && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${role.className}`}>{role.label}</span>}
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-indigo-700">{Math.round(c.score.total)}</span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-500">match</span>
        </div>
      </header>

      <p className="text-sm font-medium text-slate-700">{matchSummary(c)}</p>
      {c.kind === 'user' && c.user?.bio && <p className="text-sm text-slate-600">{c.user.bio}</p>}

      {!!c.sharedInterests?.length && (
        <ul aria-label="Shared interests" className="flex flex-wrap gap-1.5">
          {c.sharedInterests.map((i) => (
            <li key={i.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {i.label}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Best shared times</h3>
        {c.sharedSlots.length ? (
          <ul aria-label="Shared free slots" className="mt-1 flex flex-col gap-1 text-sm">
            {c.sharedSlots.slice(0, 3).map((s) => (
              <li key={s.start} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">
                {formatSlot(s.start, s.end)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No overlapping free time in the next 2 weeks.</p>
        )}
      </div>

      <div className="mt-auto">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Why this match</h3>
        <ScoreBreakdown score={c.score} />
      </div>
    </article>
  );
}
