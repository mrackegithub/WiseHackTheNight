import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { validateResponse } from './openapi.js';

describe('contract: groups', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let algoSubjectId: string;
  let createdGroupId: string;
  let user2Token: string;

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

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `contract_groups_${Date.now()}@sgm.local`,
        password: 'password123',
        displayName: 'Contract Groups User',
      },
    });
    user2Token = regRes.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /groups 201 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Contract Test Pod',
        subjectId: algoSubjectId,
        maxSize: 4,
        description: 'Testing contract compliance',
        isOpen: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    createdGroupId = body.id;

    const { valid, errors } = validateResponse('/groups', 'post', 201, body);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /groups 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/groups', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /groups/{groupId} 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${createdGroupId}`,
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/groups/{groupId}', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /groups/{groupId}/members 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${createdGroupId}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/groups/{groupId}/members', 'post', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /groups/{groupId}/suggested-slots 200 matches OpenAPI schema', async () => {
    const now = new Date();
    const from = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${createdGroupId}/suggested-slots?from=${from}&to=${to}&minMinutes=60`,
      headers: { authorization: `Bearer ${demoToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/groups/{groupId}/suggested-slots', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('DELETE /groups/{groupId}/members 204 succeeds', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/groups/${createdGroupId}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });

    expect(res.statusCode).toBe(204);
  });
});

