import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B6: Matching Candidates Deck', () => {
  let app: FastifyInstance;
  let demoToken: string;
  let algoSubjectId: string;
  let demoUserId: string;

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
    const decoded = app.jwt.decode<{ sub: string }>(demoToken);
    demoUserId = decoded!.sub;

    const subject = await app.prisma.subject.findUnique({
      where: { code: 'IP-18AA1E' },
    });
    algoSubjectId = subject!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing subjectId with 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/matching/candidates',
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns ranked user candidates with score breakdown and shared slots in < 300ms', async () => {
    const start = performance.now();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&limit=10`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    const durationMs = performance.now() - start;

    expect(res.statusCode).toBe(200);
    // Performance target: < 300 ms p95 on seed data
    expect(durationMs).toBeLessThan(300);

    const candidates = res.json();
    expect(candidates).toBeInstanceOf(Array);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(10);

    const first = candidates[0];
    expect(first.kind).toBe('user');
    expect(first.id).toBeDefined();
    expect(first.subjectId).toBe(algoSubjectId);
    expect(first.user).toBeDefined();
    expect(first.user.displayName).toBeDefined();
    expect(first.role).toBeDefined();
    expect(first.score).toBeDefined();
    expect(first.score.total).toBeGreaterThan(0);
    expect(first.score.roleComplement).toBeDefined();
    expect(first.score.timeOverlap).toBeDefined();
    expect(first.sharedSlots).toBeInstanceOf(Array);

    // Verify candidates are sorted descending by score
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score.total).toBeGreaterThanOrEqual(candidates[i].score.total);
    }
  });

  it('excludes users already swiped within 14 days', async () => {
    // Get current candidate deck
    const initialRes = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&limit=5`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    const candidates = initialRes.json();
    expect(candidates.length).toBeGreaterThan(0);
    const targetCandidateId = candidates[0].id;

    // Record a swipe on this candidate
    await app.prisma.swipe.create({
      data: {
        swiperId: demoUserId,
        targetKind: 'user',
        targetId: targetCandidateId,
        subjectId: algoSubjectId,
        direction: 'PASS',
      },
    });

    // Request candidates again
    const updatedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&limit=10`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    const updatedCandidates = updatedRes.json();
    const found = updatedCandidates.some((c: { id: string }) => c.id === targetCandidateId);
    expect(found).toBe(false);
  });

  it('returns group candidates when kind=group', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/matching/candidates?subjectId=${algoSubjectId}&kind=group&limit=5`,
      headers: { authorization: `Bearer ${demoToken}` },
    });
    expect(res.statusCode).toBe(200);
    const candidates = res.json();
    expect(candidates).toBeInstanceOf(Array);
    if (candidates.length > 0) {
      const first = candidates[0];
      expect(first.kind).toBe('group');
      expect(first.group).toBeDefined();
      expect(first.group.name).toBeDefined();
      expect(first.score.total).toBeGreaterThan(0);
    }
  });

  describe('B7: Swipes & Matches', () => {
    let testUser2Id: string;
    let testUser2Token: string;

    beforeAll(async () => {
      // Create a second test user for testing mutual swipe
      const uniqueSuffix = Date.now();
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `b7_partner_${uniqueSuffix}@sgm.local`,
          password: 'password123',
          displayName: 'B7 Partner',
        },
      });
      expect(regRes.statusCode).toBe(201);
      testUser2Token = regRes.json().accessToken;
      testUser2Id = app.jwt.decode<{ sub: string }>(testUser2Token)!.sub;

      // Add subject to partner user
      await app.prisma.userSubject.create({
        data: {
          userId: testUser2Id,
          subjectId: algoSubjectId,
          role: 'CAN_EXPLAIN',
          confidence: 4,
        },
      });
    });

    it('rejects self-swipe with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${demoToken}` },
        payload: {
          targetKind: 'user',
          targetId: demoUserId,
          subjectId: algoSubjectId,
          direction: 'LIKE',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('SELF_SWIPE');
    });

    it('records PASS swipe with no match', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${demoToken}` },
        payload: {
          targetKind: 'user',
          targetId: testUser2Id,
          subjectId: algoSubjectId,
          direction: 'PASS',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.recorded).toBe(true);
      expect(body.match).toBeNull();
    });

    it('creates group and match on mutual LIKE', async () => {
      // Partner likes demoUser first
      const partnerSwipe = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${testUser2Token}` },
        payload: {
          targetKind: 'user',
          targetId: demoUserId,
          subjectId: algoSubjectId,
          direction: 'LIKE',
        },
      });
      expect(partnerSwipe.statusCode).toBe(200);
      expect(partnerSwipe.json().recorded).toBe(true);
      expect(partnerSwipe.json().match).toBeNull();

      // DemoUser now likes partner -> mutual match!
      const demoSwipe = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${demoToken}` },
        payload: {
          targetKind: 'user',
          targetId: testUser2Id,
          subjectId: algoSubjectId,
          direction: 'LIKE',
        },
      });
      expect(demoSwipe.statusCode).toBe(200);
      const body = demoSwipe.json();
      expect(body.recorded).toBe(true);
      expect(body.match).toBeDefined();
      expect(body.match.id).toBeDefined();
      expect(body.match.subject.id).toBe(algoSubjectId);
      expect(body.match.otherUser.id).toBe(testUser2Id);
      expect(body.match.groupId).toBeDefined();

      // Check group created with partner as owner (partner liked first)
      const group = await app.prisma.group.findUnique({
        where: { id: body.match.groupId },
        include: { members: true },
      });
      expect(group).toBeDefined();
      expect(group!.members).toHaveLength(2);
      const ownerMember = group!.members.find((m) => m.isOwner);
      expect(ownerMember?.userId).toBe(testUser2Id);
    });

    it('joins open group on LIKE and fails with GROUP_FULL when full', async () => {
      // Create a test group with maxSize: 2
      const testGroup = await app.prisma.group.create({
        data: {
          name: 'Tiny Study Group',
          subjectId: algoSubjectId,
          maxSize: 2,
          isOpen: true,
          members: {
            create: [
              { userId: testUser2Id, role: 'PEER', isOwner: true },
            ],
          },
        },
      });

      // Demo user likes (joins) the group
      const joinRes = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${demoToken}` },
        payload: {
          targetKind: 'group',
          targetId: testGroup.id,
          subjectId: algoSubjectId,
          direction: 'LIKE',
        },
      });
      expect(joinRes.statusCode).toBe(200);
      const joinBody = joinRes.json();
      expect(joinBody.recorded).toBe(true);
      expect(joinBody.match).toBeDefined();
      expect(joinBody.match.groupId).toBe(testGroup.id);

      // Now create a 3rd user trying to join the full group
      const reg3 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `b7_third_${Date.now()}_${Math.random().toString(36).substring(7)}@sgm.local`,
          password: 'password123',
          displayName: 'Third User',
        },
      });
      const user3Token = reg3.json().accessToken;

      const fullRes = await app.inject({
        method: 'POST',
        url: '/api/v1/matching/swipes',
        headers: { authorization: `Bearer ${user3Token}` },
        payload: {
          targetKind: 'group',
          targetId: testGroup.id,
          subjectId: algoSubjectId,
          direction: 'LIKE',
        },
      });
      expect(fullRes.statusCode).toBe(409);
      expect(fullRes.json().code).toBe('GROUP_FULL');
    });

    it('lists matches with cursor pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/matching/matches?limit=10',
        headers: { authorization: `Bearer ${demoToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toBeInstanceOf(Array);
      expect(body.items.length).toBeGreaterThan(0);
      const first = body.items[0];
      expect(first.id).toBeDefined();
      expect(first.subject).toBeDefined();
      expect(first.groupId).toBeDefined();
    });
  });
});
