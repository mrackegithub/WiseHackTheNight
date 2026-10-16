import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { validateResponse } from './openapi.js';

describe('contract: sessions', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let algoSubjectId: string;
  let groupId: string;

  beforeAll(async () => {
    app = await buildApp();

    const stamp = Date.now();
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `contract_sessions_${stamp}@sgm.local`,
        password: 'password123',
        displayName: 'Contract Sessions User',
      },
    });
    demoToken = regRes.json().accessToken;

    const subject = await app.prisma.subject.findUnique({
      where: { code: 'IP-18AA1E' },
    });
    algoSubjectId = subject!.id;

    // Create a group for session contract test
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Contract Sessions Group',
        subjectId: algoSubjectId,
        maxSize: 4,
      },
    });
    groupId = createRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /groups/{groupId}/sessions 201 matches OpenAPI schema', async () => {
    const start = new Date(Date.now() + 20 * 86400000).toISOString();
    const end = new Date(Date.now() + 20 * 86400000 + 7200000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        start,
        end,
        onlineUrl: 'https://meet.jit.si/sgm-contract-session',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    const { valid, errors } = validateResponse('/groups/{groupId}/sessions', 'post', 201, body);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /groups/{groupId}/sessions 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const { valid, errors } = validateResponse('/groups/{groupId}/sessions', 'get', 200, body);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});

