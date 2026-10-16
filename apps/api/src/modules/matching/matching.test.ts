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
});
