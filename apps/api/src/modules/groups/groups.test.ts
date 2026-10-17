import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B8: Groups Module', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let demoUserId: string;
  let algoSubjectId: string;
  let user2Token: string;
  let user2Id: string;

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
    demoUserId = app.jwt.decode<{ sub: string }>(demoToken)!.sub;

    const subject = await app.prisma.subject.findUnique({
      where: { code: 'BME-PROG1' },
    });
    algoSubjectId = subject!.id;

    // Create user2 for join/leave tests
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `b8_test_${Date.now()}@sgm.local`,
        password: 'password123',
        displayName: 'Group Test User 2',
      },
    });
    expect(regRes.statusCode).toBe(201);
    user2Token = regRes.json().accessToken;
    user2Id = app.jwt.decode<{ sub: string }>(user2Token)!.sub;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated GET /groups with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
    });
    expect(res.statusCode).toBe(401);
  });

  it('lists groups the current user belongs to', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(res.statusCode).toBe(200);
    const groups = res.json();
    expect(groups).toBeInstanceOf(Array);
    expect(groups.length).toBeGreaterThan(0);
    const first = groups[0];
    expect(first.id).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.subject).toBeDefined();
    expect(first.memberCount).toBeGreaterThanOrEqual(1);
    expect(first.maxSize).toBeDefined();
  });

  it('creates a new group and returns 201 with Group', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Algorithms Masters Club',
        subjectId: algoSubjectId,
        maxSize: 3,
        description: 'Elite study club for algorithms',
        isOpen: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const group = res.json();
    expect(group.id).toBeDefined();
    expect(group.name).toBe('Algorithms Masters Club');
    expect(group.subject.id).toBe(algoSubjectId);
    expect(group.memberCount).toBe(1);
    expect(group.maxSize).toBe(3);
    expect(group.isOpen).toBe(true);
    expect(group.members).toHaveLength(1);
    expect(group.members[0].user.id).toBe(demoUserId);
    expect(group.members[0].isOwner).toBe(true);
  });

  it('gets group details by groupId', async () => {
    // Create a group
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Detail Test Group',
        subjectId: algoSubjectId,
        maxSize: 4,
      },
    });
    const created = createRes.json();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${created.id}`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(res.statusCode).toBe(200);
    const group = res.json();
    expect(group.id).toBe(created.id);
    expect(group.name).toBe('Detail Test Group');
    expect(group.members).toHaveLength(1);
  });

  it('allows a user to join and leave a group', async () => {
    // Demo user creates a group
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Join Leave Test Group',
        subjectId: algoSubjectId,
        maxSize: 2,
        isOpen: true,
      },
    });
    const group = createRes.json();

    // User2 joins the group
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${group.id}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(joinRes.statusCode).toBe(200);
    const joinedGroup = joinRes.json();
    expect(joinedGroup.memberCount).toBe(2);
    expect(joinedGroup.members).toHaveLength(2);
    expect(joinedGroup.isOpen).toBe(false); // Max size reached (2/2)

    // User2 tries to join again -> 409 ALREADY_MEMBER
    const duplicateJoin = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${group.id}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(duplicateJoin.statusCode).toBe(409);
    expect(duplicateJoin.json().code).toBe('ALREADY_MEMBER');

    // User2 leaves the group -> 204
    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/groups/${group.id}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });
    expect(leaveRes.statusCode).toBe(204);

    // Group should be re-opened now that it has 1/2 members
    const checkGroup = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${group.id}`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(checkGroup.json().memberCount).toBe(1);
    expect(checkGroup.json().isOpen).toBe(true);
  });

  it('suggests intersecting free slots for group members', async () => {
    // Demo user creates a group and User2 joins
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      headers: { authorization: `Bearer ${demoToken}` },
      payload: {
        name: 'Slots Study Group',
        subjectId: algoSubjectId,
        maxSize: 4,
      },
    });
    const group = createRes.json();

    await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${group.id}/members`,
      headers: { authorization: `Bearer ${user2Token}` },
    });

    const now = new Date();
    const from = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${group.id}/suggested-slots?from=${from}&to=${to}&minMinutes=60`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(res.statusCode).toBe(200);
    const slots = res.json();
    expect(slots).toBeInstanceOf(Array);
    if (slots.length > 0) {
      const first = slots[0];
      expect(first.start).toBeDefined();
      expect(first.end).toBeDefined();
      expect(first.availableMemberIds).toContain(demoUserId);
      expect(first.availableMemberIds).toContain(user2Id);
      expect(first.score).toBeGreaterThan(0);
    }
  });
});

