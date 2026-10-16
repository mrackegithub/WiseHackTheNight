import { describe, expect, it, vi } from 'vitest';
import { createAuthFetch } from './client';
import type { AuthTokens } from './tokens';

const BASE = 'http://api.test/api/v1';

function memoryTokens(initial: AuthTokens | null) {
  let current = initial;
  return {
    get: () => current,
    set: (t: AuthTokens | null) => {
      current = t;
    },
    clear: () => {
      current = null;
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Fake server: accepts only `valid` as access token; /auth/refresh issues `fresh-N`. */
function fakeServer({ refreshOk = true } = {}) {
  let valid = 'old';
  let refreshCalls = 0;
  const fetch = vi.fn(async (req: Request) => {
    if (req.url.endsWith('/auth/refresh')) {
      refreshCalls += 1;
      if (!refreshOk) return json(401, { code: 'UNAUTHORIZED', message: 'nope' });
      valid = `fresh-${refreshCalls}`;
      return json(200, { accessToken: valid, refreshToken: `r-${refreshCalls}`, expiresIn: 900 });
    }
    const auth = req.headers.get('Authorization');
    return auth === `Bearer ${valid}` ? json(200, { ok: true, body: await req.text() }) : json(401, { code: 'UNAUTHORIZED', message: 'expired' });
  });
  return { fetch, expire: () => (valid = 'something-else'), refreshCalls: () => refreshCalls };
}

describe('createAuthFetch', () => {
  it('sends the access token as a Bearer header', async () => {
    const server = fakeServer();
    const authFetch = createAuthFetch({ baseUrl: BASE, tokens: memoryTokens({ accessToken: 'old', refreshToken: 'r', expiresIn: 900 }), fetch: server.fetch });
    const res = await authFetch(new Request(`${BASE}/me`));
    expect(res.status).toBe(200);
    expect(server.refreshCalls()).toBe(0);
  });

  it('refreshes on 401 and retries the original request with its body', async () => {
    const server = fakeServer();
    server.expire();
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'r', expiresIn: 900 });
    const authFetch = createAuthFetch({ baseUrl: BASE, tokens, fetch: server.fetch });

    const res = await authFetch(new Request(`${BASE}/me`, { method: 'PATCH', body: '{"bio":"hi"}' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, body: '{"bio":"hi"}' });
    expect(tokens.get()?.accessToken).toBe('fresh-1');
  });

  it('shares one refresh between concurrent 401s', async () => {
    const server = fakeServer();
    server.expire();
    const authFetch = createAuthFetch({ baseUrl: BASE, tokens: memoryTokens({ accessToken: 'old', refreshToken: 'r', expiresIn: 900 }), fetch: server.fetch });

    const results = await Promise.all([1, 2, 3].map(() => authFetch(new Request(`${BASE}/me`))));

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(server.refreshCalls()).toBe(1);
  });

  it('clears the session and reports failure when the refresh is rejected', async () => {
    const server = fakeServer({ refreshOk: false });
    server.expire();
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'r', expiresIn: 900 });
    const onAuthFailure = vi.fn();
    const authFetch = createAuthFetch({ baseUrl: BASE, tokens, fetch: server.fetch, onAuthFailure });

    const res = await authFetch(new Request(`${BASE}/me`));

    expect(res.status).toBe(401);
    expect(tokens.get()).toBeNull();
    expect(onAuthFailure).toHaveBeenCalledOnce();
  });

  it('does not try to refresh for auth endpoints (e.g. wrong password on login)', async () => {
    const server = fakeServer();
    const authFetch = createAuthFetch({ baseUrl: BASE, tokens: memoryTokens({ accessToken: 'x', refreshToken: 'r', expiresIn: 900 }), fetch: server.fetch });
    server.fetch.mockResolvedValueOnce(json(401, { code: 'UNAUTHORIZED', message: 'bad password' }));

    const res = await authFetch(new Request(`${BASE}/auth/login`, { method: 'POST', body: '{}' }));

    expect(res.status).toBe(401);
    expect(server.refreshCalls()).toBe(0);
  });
});
