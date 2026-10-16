import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { geocode } from '../data/places';
import { apiError, authed, url } from '../utils';

export const locationHandlers = [
  http.get(
    url('/locations/geocode'),
    authed((_user, { request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      if (q.trim().length < 3) return apiError(422, 'VALIDATION_FAILED', 'Query too short', [{ path: 'q', issue: 'must be at least 3 characters' }]);
      return HttpResponse.json<Schemas['GeoPoint'][]>(geocode(q));
    }),
  ),
];
