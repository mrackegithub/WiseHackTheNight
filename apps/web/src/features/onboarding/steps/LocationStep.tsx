import { lazy, Suspense, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Schemas } from '@sgm/contracts';
import { api } from '../../../api/client';
import { unwrap } from '../../../api/errors';
import { Button } from '../../../components/form/Button';
import { Spinner } from '../../../components/Spinner';
import { messageForError } from '../../../lib/error-messages';
import { meQueryKey, useAuth } from '../../auth/auth-context';
import { useMyPreferences } from '../../profile/queries';
import { StepLayout } from '../StepLayout';
import type { StepProps } from './types';

const MapPicker = lazy(() => import('../../../components/map/MapPicker'));

type Point = Schemas['GeoPointInput'];

export function LocationStep({ onNext, onBack }: StepProps) {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const prefs = useMyPreferences();
  const onlineOnly = prefs.data?.mode === 'ONLINE';

  const [point, setPoint] = useState<Point | null>(me?.location ?? null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['geocode', submitted],
    queryFn: () => unwrap(api.GET('/locations/geocode', { params: { query: { q: submitted } } })),
    enabled: submitted.length >= 3,
    staleTime: Infinity,
    retry: false, // the provider allows 1 request/s; shown inline below instead of a toast
    meta: { silent: true },
  });

  const save = useMutation({
    mutationFn: (body: Point) => unwrap(api.PUT('/me/location', { body })),
    meta: { silent: true },
    onSuccess: (saved) => {
      queryClient.setQueryData<Schemas['Me']>(meQueryKey, (old) => (old ? { ...old, location: saved } : old));
      onNext();
    },
  });

  function search() {
    const q = query.trim();
    if (q.length < 3) return setError('Type at least 3 characters to search.');
    setError(null);
    setSubmitted(q);
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit the step
      search();
    }
  }

  function submit() {
    if (point) return save.mutate({ ...point, label: point.label ? point.label.slice(0, 120) : undefined });
    if (prefs.isLoading) return;
    if (onlineOnly) return onNext();
    setError('Search for an address or click the map to set your home base.');
  }

  return (
    <StepLayout
      title="Your home base"
      description="Used to find nearby partners and places. It's rounded to about 100 m and never shown to others, who only see a distance."
      onSubmit={submit}
      onBack={onBack}
      submitLabel={point || (!prefs.isLoading && !onlineOnly) ? 'Finish' : 'Skip and finish'}
      saving={save.isPending}
      error={error ?? (save.error ? messageForError(save.error) : null)}
    >
      {onlineOnly && <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">You study online only, so this is optional.</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="address" className="text-sm font-medium text-slate-700">
          Address or landmark
        </label>
        <div className="flex gap-2">
          <input
            id="address"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 120))}
            onKeyDown={onSearchKey}
            placeholder="e.g. Kálvin tér"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <Button variant="secondary" onClick={search} loading={results.isFetching}>
            Search
          </Button>
        </div>
        {submitted && results.isError && (
          <p role="alert" className="text-sm text-red-700">
            {messageForError(results.error)}
          </p>
        )}
        {submitted && results.data && (
          <ul aria-label="Address results" className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white text-sm">
            {results.data.length === 0 && <li className="px-3 py-2 text-slate-500">No places found. Try another search or use the map.</li>}
            {results.data.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button
                  type="button"
                  onClick={() => setPoint({ ...r, label: r.label ? r.label.slice(0, 120) : undefined })}
                  className="w-full px-3 py-2 text-left hover:bg-indigo-50"
                >
                  {r.label ?? `${r.lat}, ${r.lng}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Suspense fallback={<Spinner label="Loading map" />}>
        <MapPicker value={point} onChange={(p) => setPoint({ ...p, label: 'Pinned on map' })} />
      </Suspense>

      <p className="text-sm text-slate-600" aria-live="polite">
        {point ? (
          <>
            Selected: <span className="font-medium">{point.label ?? 'Pinned on map'}</span>{' '}
            <span className="text-xs text-slate-500">
              ({point.lat.toFixed(3)}, {point.lng.toFixed(3)})
            </span>
          </>
        ) : (
          'No location selected yet.'
        )}
      </p>
    </StepLayout>
  );
}
