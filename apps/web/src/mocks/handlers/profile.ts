import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { interestById, interests } from '../data/interests';
import { subjectById } from '../data/subjects';
import { defaultPreferences } from '../db';
import { apiError, authed, url } from '../utils';

type Detail = { path: string; issue: string };

export const profileHandlers = [
  http.get(
    url('/me'),
    authed((user) => HttpResponse.json<Schemas['Me']>(user.me)),
  ),

  http.patch(
    url('/me'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['UpdateMeRequest'];
      const details: Detail[] = [];
      if (body.displayName !== undefined && (body.displayName.trim().length < 2 || body.displayName.trim().length > 50)) {
        details.push({ path: 'displayName', issue: 'must be 2–50 characters' });
      }
      if (body.bio && body.bio.length > 300) details.push({ path: 'bio', issue: 'must be at most 300 characters' });
      if (body.interestIds && body.interestIds.length > 15) details.push({ path: 'interestIds', issue: 'at most 15 interests' });
      if (body.interestIds?.some((id) => !interestById(id))) details.push({ path: 'interestIds', issue: 'unknown interest' });
      if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Invalid profile', details);

      const { interestIds, ...fields } = body;
      user.me = {
        ...user.me,
        ...fields,
        ...(fields.displayName ? { displayName: fields.displayName.trim() } : {}),
        ...(interestIds ? { interests: interestIds.map((id) => interestById(id)!) } : {}),
      };
      return HttpResponse.json<Schemas['Me']>(user.me);
    }),
  ),

  http.get(
    url('/me/subjects'),
    authed((user) => HttpResponse.json<Schemas['UserSubject'][]>(user.subjects)),
  ),

  http.put(
    url('/me/subjects'),
    authed(async (user, { request }) => {
      const body = (await request.json()) as Schemas['UserSubjectInput'][];
      if (!Array.isArray(body) || body.length > 30) {
        return apiError(422, 'VALIDATION_FAILED', 'Invalid subjects', [{ path: '', issue: 'at most 30 subjects' }]);
      }
      const unknown = body.find((s) => !subjectById(s.subjectId));
      if (unknown) return apiError(422, 'VALIDATION_FAILED', 'Unknown subject', [{ path: 'subjectId', issue: `unknown subject ${unknown.subjectId}` }]);

      user.subjects = body.map((s) => ({ subject: subjectById(s.subjectId)!, role: s.role, confidence: s.confidence ?? 3 }));
      return HttpResponse.json<Schemas['UserSubject'][]>(user.subjects);
    }),
  ),

  http.get(url('/interests'), () => HttpResponse.json<Schemas['Interest'][]>(interests)),

  http.get(
    url('/me/preferences'),
    authed((user) => HttpResponse.json<Schemas['Preferences']>(user.preferences ?? defaultPreferences())),
  ),

  http.put(
    url('/me/preferences'),
    authed(async (user, { request }) => {
      const p = (await request.json()) as Schemas['Preferences'];
      const details: Detail[] = [];
      const between = (v: number, min: number, max: number) => typeof v === 'number' && v >= min && v <= max;
      if (!between(p.groupSizeMin, 2, 10)) details.push({ path: 'groupSizeMin', issue: 'must be 2–10' });
      if (!between(p.groupSizeMax, 2, 10)) details.push({ path: 'groupSizeMax', issue: 'must be 2–10' });
      if (p.groupSizeMin > p.groupSizeMax) details.push({ path: 'groupSizeMin', issue: 'must not exceed groupSizeMax' });
      if (!between(p.maxDistanceKm, 0.5, 50)) details.push({ path: 'maxDistanceKm', issue: 'must be 0.5–50' });
      if (!between(p.sessionLengthMinutes, 30, 240)) details.push({ path: 'sessionLengthMinutes', issue: 'must be 30–240' });
      if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Invalid preferences', details);

      user.preferences = p;
      return HttpResponse.json<Schemas['Preferences']>(p);
    }),
  ),
];
