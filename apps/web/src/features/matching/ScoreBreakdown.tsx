import type { Schemas } from '@sgm/contracts';

type Component = Exclude<keyof Schemas['ScoreBreakdown'], 'total'>;

const components: { key: Component; label: string }[] = [
  { key: 'timeOverlap', label: 'Shared free time' },
  { key: 'roleComplement', label: 'Role fit' },
  { key: 'interests', label: 'Shared interests' },
  { key: 'proximity', label: 'Distance' },
  { key: 'groupSizeFit', label: 'Group size fit' },
];

/** Why this candidate ranks where it does: each component in [0, 1] as a bar. */
export function ScoreBreakdown({ score }: { score: Schemas['ScoreBreakdown'] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr_2.5rem] items-center gap-x-2 gap-y-1 text-xs">
      {components.map(({ key, label }) => {
        const pct = Math.round(Math.min(1, Math.max(0, score[key])) * 100);
        return (
          <div key={key} className="contents">
            <dt className="text-slate-600">{label}</dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </dd>
            <dd className="text-right tabular-nums text-slate-700" aria-label={`${label} ${pct}%`}>
              {pct}%
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
