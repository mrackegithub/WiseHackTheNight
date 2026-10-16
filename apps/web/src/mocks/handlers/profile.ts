import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { subjectById } from '../data/subjects';
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
      if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Invalid profile', details);

      const fields = { ...body };
      delete fields.interestIds; // interests are wired up with the interests step
      user.me = { ...user.me, ...fields, ...(fields.displayName ? { displayName: fields.displayName.trim() } : {}) };
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
];
