import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B9: Sessions Module', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let nonMemberToken: string;
  let algoSubjectId: string;
  let groupId: string;

  beforeAll(async () => {
    app = await buildApp();

    let loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'demo@sgm.local', password: 'password123' },
    });

    if (loginRes.statusCode !== 200) {
      const { seedCore } = await import('../../../prisma/seed/core.seed.js');
      await seedCore(app.prisma);
      loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'demo@sgm.local', password: 'password123' },
      });
    }

    demoToken = loginRes.json().accessToken;

    const subject = await app.prisma.subject.findUnique({
      where: { code: 'IP-18AA1E' },
    });
    algoSubjectId = subject!.id;

    // Create a non-member user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `non_member_${Date.now()}@sgm.local`,
        password: 'password123',
        displayName: 'Non Member',
      },
    });
    nonMemberToken = regRes.json().accessToken;

    // Create a group for demo user
    const createGroupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Session Test Pod',
        subjectId: algoSubjectId,
        maxSize: 4,
      },
    });
    groupId = createGroupRes.json().id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupId}/sessions`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects session creation by a non-member with 403', async () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    const end = new Date(Date.now() + 86400000 + 7200000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${nonMemberToken}` },
      payload: { start, end },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects session creation with start >= end with 422', async () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    const end = start;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
      payload: { start, end },
    });
    expect(res.statusCode).toBe(422);
  });

  it('creates and lists group sessions', async () => {
    const startTime = new Date(Date.now() + 10 * 86400000);
    const endTime = new Date(startTime.getTime() + 7200000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        onlineUrl: 'https://meet.jit.si/sgm-test-session',
      },
    });

    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session.id).toBeDefined();
    expect(session.groupId).toBe(groupId);
    expect(session.status).toBe('PLANNED');
    expect(session.onlineUrl).toBe('https://meet.jit.si/sgm-test-session');

    // List sessions
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const sessions = listRes.json();
    expect(sessions).toBeInstanceOf(Array);
    const found = sessions.find((s: { id: string }) => s.id === session.id);
    expect(found).toBeDefined();
  });

  it('rejects conflicting session slot with 409 MEMBER_BUSY', async () => {
    // Attempt to schedule an overlapping session in the same window
    const startTime = new Date(Date.now() + 10 * 86400000 + 3600000); // 1 hour into existing session
    const endTime = new Date(startTime.getTime() + 7200000);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${groupId}/sessions`,
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('MEMBER_BUSY');
  });
});

