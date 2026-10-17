import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { validateResponse } from './openapi.js';

describe('contract: matching candidates', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let algoSubjectId: string;

  beforeAll(async () => {
    app = await buildApp();

    let loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'demo@sgm.local', password: 'password123' },
    });

    if (loginRes.statusCode !== 200) {
      const { seedCore } = await import('../../prisma/seed/core.seed.js');
      await seedCore(app.prisma);
      loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'demo@sgm.local', password: 'password123' },
      });
    }

    demoToken = loginRes.json().accessToken;

    const subject = await app.prisma.subject.findUnique({
      where: { code: 'BME-PROG1' },
    });
    algoSubjectId = subject!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /matching/candidates 200 matches OpenAPI schema for user candidates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&limit=5`,
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/matching/candidates', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /matching/candidates 200 matches OpenAPI schema for group candidates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&kind=group&limit=5`,
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/matching/candidates', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /matching/swipes 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matching/swipes',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        targetKind: 'user',
        targetId: 'a0000000-0000-4000-a000-000000000001',
        subjectId: algoSubjectId,
        direction: 'PASS',
      },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/matching/swipes', 'post', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /matching/matches 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/matching/matches?limit=10',
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/matching/matches', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
