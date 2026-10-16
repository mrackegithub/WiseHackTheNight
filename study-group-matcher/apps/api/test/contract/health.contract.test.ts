import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { validateResponse } from './openapi';

describe('contract: getHealth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => app.close());

  it('matches the OpenAPI 200 schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(validateResponse('/health', 'get', 200, res.json()).errors).toEqual([]);
  });
});
