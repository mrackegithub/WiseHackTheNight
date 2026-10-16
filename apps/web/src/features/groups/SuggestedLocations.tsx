import { lazy, Suspense, useMemo, useState } from 'react';
import type { Schemas } from '@sgm/contracts';
import { QueryError } from '../../components/QueryError';
import { Spinner } from '../../components/Spinner';
import { locationTypeLabels } from '../../lib/labels';
import { useSuggestedLocations } from './queries';

const LocationsMap = lazy(() => import('../../components/map/LocationsMap'));

type LocationType = Schemas['LocationType'];

export function SuggestedLocations({ groupId }: { groupId: string }) {
  const [type, setType] = useState<LocationType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const suggestions = useSuggestedLocations(groupId, type);

  const items = useMemo(() => suggestions.data ?? [], [suggestions.data]);
  const places = useMemo(() => items.map((s) => ({ id: s.location.id, name: s.location.name, lat: s.location.point.lat, lng: s.location.point.lng })), [items]);

  return (
    <section aria-labelledby="places-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="places-heading" className="font-semibold">
          Suggested places
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Type
          <select
            value={type ?? ''}
            onChange={(e) => {
              setType((e.target.value || null) as LocationType | null);
              setSelectedId(null);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">Any place</option>
            {(Object.keys(locationTypeLabels) as LocationType[]).map((t) => (
              <option key={t} value={t}>
                {locationTypeLabels[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600">Near all of you, ranked so nobody has to travel much further than the others.</p>

      {suggestions.isPending ? (
        <Spinner label="Finding places" />
      ) : suggestions.isError ? (
        <QueryError compact what="suggested places" error={suggestions.error} onRetry={() => void suggestions.refetch()} />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No {type ? locationTypeLabels[type].toLowerCase() : 'place'} within 3 km of the group. Try another type.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ol className="flex flex-col gap-2" aria-label="Places">
            {items.map((s, i) => {
              const l = s.location;
              const selected = l.id === selectedId;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {i + 1}. {l.name}
                      </span>
                      {l.bookable && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Bookable</span>}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {locationTypeLabels[l.type]}
                      {l.address ? ` · ${l.address}` : ''}
                    </span>
                    <span className="block text-xs text-slate-600">
                      At most {s.maxMemberDistanceKm} km for anyone · {s.avgMemberDistanceKm} km on average
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <Suspense fallback={<Spinner label="Loading map" />}>
            <LocationsMap places={places} selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>
        </div>
      )}
    </section>
  );
}
