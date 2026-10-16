import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B3: Subjects & Interests Module', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Seed test subjects and interests
    await app.prisma.interest.createMany({
      data: [
        { slug: 'subj-test-interest-1', label: 'Test Interest 1' },
        { slug: 'subj-test-interest-2', label: 'Test Interest 2' },
      ],
      skipDuplicates: true,
    });

    await app.prisma.subject.createMany({
      data: [
        { code: 'SUBJ-A1', name: 'Algorithms 1', credits: 5 },
        { code: 'SUBJ-A2', name: 'Algorithms 2', credits: 5 },
        { code: 'SUBJ-B1', name: 'Biology 1', credits: 4 },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await app.prisma.subject.deleteMany({
      where: { code: { startsWith: 'SUBJ-' } },
    });
    await app.prisma.interest.deleteMany({
      where: { slug: { startsWith: 'subj-test-interest-' } },
    });
    await app.close();
  });

  describe('GET /api/v1/interests', () => {
    it('returns array of interests', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/interests' });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toBeInstanceOf(Array);
      expect(json.length).toBeGreaterThanOrEqual(2);
      expect(json[0]).toHaveProperty('id');
      expect(json[0]).toHaveProperty('slug');
      expect(json[0]).toHaveProperty('label');
    });
  });

  describe('GET /api/v1/subjects', () => {
    it('returns subjects list with nextCursor', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=2' });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json).toHaveProperty('items');
      expect(json).toHaveProperty('nextCursor');
      expect(json.items).toBeInstanceOf(Array);
      expect(json.items.length).toBeLessThanOrEqual(2);
    });

    it('filters subjects by search term q', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/subjects?q=Algorithms' });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items.length).toBeGreaterThanOrEqual(2);
      for (const item of json.items) {
        const matches =
          item.name.toLowerCase().includes('algorithms') ||
          item.code.toLowerCase().includes('algorithms');
        expect(matches).toBe(true);
      }
    });

    it('paginates correctly using cursor', async () => {
      const firstPage = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=1' });
      expect(firstPage.statusCode).toBe(200);
      const firstJson = firstPage.json();
      expect(firstJson.items).toHaveLength(1);
      expect(firstJson.nextCursor).toBeDefined();

      if (firstJson.nextCursor) {
        const secondPage = await app.inject({
          method: 'GET',
          url: `/api/v1/subjects?limit=1&cursor=${firstJson.nextCursor}`,
        });
        expect(secondPage.statusCode).toBe(200);
        const secondJson = secondPage.json();
        expect(secondJson.items).toHaveLength(1);
        expect(secondJson.items[0].id).not.toBe(firstJson.items[0].id);
      }
    });
  });
});
