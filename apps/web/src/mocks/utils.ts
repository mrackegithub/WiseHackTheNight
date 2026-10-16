import { HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw';
import type { Schemas } from '@sgm/contracts';
import { config } from '../lib/config';
import { db, type MockUser } from './db';

/** Absolute URL for a contract path, e.g. url('/me'). */
export const url = (path: string) => `${config.apiUrl}${path}`;

export function apiError(status: number, code: string, message: string, details?: Schemas['Error']['details']) {
  return HttpResponse.json<Schemas['Error']>({ code, message, ...(details ? { details } : {}) }, { status });
}

export function currentUser(request: Request): MockUser | null {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  const userId = token ? db.accessTokens.get(token) : undefined;
  return userId ? (db.users.get(userId) ?? null) : null;
}

/** Wraps a resolver so it only runs for a valid Bearer token (401 UNAUTHORIZED otherwise). */
export function authed<Params extends PathParams, Body extends DefaultBodyType>(
  resolver: (user: MockUser, info: Parameters<HttpResponseResolver<Params, Body>>[0]) => ReturnType<HttpResponseResolver<Params, Body>>,
): HttpResponseResolver<Params, Body> {
  return (info) => {
    const user = currentUser(info.request);
    if (!user) return apiError(401, 'UNAUTHORIZED', 'Missing or invalid access token');
    return resolver(user, info);
  };
}
