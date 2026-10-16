import { http, HttpResponse } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { db, findUserByEmail, issueTokens, newMockUser, nextId } from '../db';
import { apiError, url } from '../utils';

export const authHandlers = [
  http.post<never, Schemas['RegisterRequest']>(url('/auth/register'), async ({ request }) => {
    const body = await request.json();
    const details: { path: string; issue: string }[] = [];
    if (!/^\S+@\S+\.\S+$/.test(body.email ?? '')) details.push({ path: 'email', issue: 'must be a valid email' });
    if ((body.password ?? '').length < 8) details.push({ path: 'password', issue: 'must be at least 8 characters' });
    const name = (body.displayName ?? '').trim();
    if (name.length < 2 || name.length > 50) details.push({ path: 'displayName', issue: 'must be 2–50 characters' });
    if (details.length) return apiError(422, 'VALIDATION_FAILED', 'Invalid registration', details);
    if (findUserByEmail(body.email)) return apiError(409, 'CONFLICT', 'Email already registered');

    const id = nextId();
    db.users.set(
      id,
      newMockUser(
        {
          id,
          email: body.email.trim().toLowerCase(),
          displayName: name,
          bio: null,
          avatarUrl: null,
          university: null,
          faculty: null,
          location: null,
          interests: [],
          onboardingComplete: false,
          createdAt: new Date().toISOString(),
        },
        body.password,
      ),
    );
    return HttpResponse.json<Schemas['AuthTokens']>(issueTokens(id), { status: 201 });
  }),

  http.post<never, Schemas['LoginRequest']>(url('/auth/login'), async ({ request }) => {
    const body = await request.json();
    const user = findUserByEmail(body.email ?? '');
    if (!user || user.password !== body.password) return apiError(401, 'UNAUTHORIZED', 'Invalid email or password');
    return HttpResponse.json<Schemas['AuthTokens']>(issueTokens(user.me.id));
  }),

  http.post<never, { refreshToken: string }>(url('/auth/refresh'), async ({ request }) => {
    const { refreshToken } = await request.json();
    const userId = db.refreshTokens.get(refreshToken);
    if (!userId) return apiError(401, 'UNAUTHORIZED', 'Invalid refresh token');
    db.refreshTokens.delete(refreshToken); // rotating refresh tokens, like the real API
    return HttpResponse.json<Schemas['AuthTokens']>(issueTokens(userId));
  }),
];
