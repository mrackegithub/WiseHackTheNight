import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { validateResponse } from './openapi.js';

describe('contract: profile, subjects, and interests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testSubjectId: string;

  beforeAll(async () => {
    app = await buildApp();

    const subject = await app.prisma.subject.upsert({
      where: { code: 'CONTRACT-SUBJ-1' },
      update: {},
      create: { code: 'CONTRACT-SUBJ-1', name: 'Contract Subject 1', credits: 3 },
    });
    testSubjectId = subject.id;

    const email = `contract-profile-${Date.now()}@sgm.local`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Contract Profile' },
    });
    authToken = regRes.json().accessToken;
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({
      where: { email: { contains: 'contract-profile-' } },
    });
    await app.prisma.subject.deleteMany({
      where: { code: { contains: 'CONTRACT-SUBJ-' } },
    });
    await app.close();
  });

  it('GET /me 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('PATCH /me 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { displayName: 'Updated Profile Name', bio: 'Short bio' },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me', 'patch', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /me/subjects 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/subjects',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me/subjects', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('PUT /me/subjects 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/subjects',
      headers: { authorization: `Bearer ${authToken}` },
      payload: [{ subjectId: testSubjectId, role: 'PEER', confidence: 4 }],
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me/subjects', 'put', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /me/preferences 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/preferences',
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me/preferences', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('PUT /me/preferences 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/preferences',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        groupSizeMin: 2,
        groupSizeMax: 5,
        maxDistanceKm: 7.5,
        sessionLengthMinutes: 90,
        locationTypes: ['LIBRARY'],
        mode: 'EITHER',
      },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me/preferences', 'put', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('PUT /me/location 200 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/location',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { lat: 47.4979, lng: 19.0402, label: 'Budapest' },
    });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/me/location', 'put', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /interests 200 matches OpenAPI schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/interests' });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/interests', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('GET /subjects 200 matches OpenAPI schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=5' });
    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/subjects', 'get', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
