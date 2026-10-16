import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../../src/app';
import { conflict, notFound } from '../../src/core/errors.js';
import { validate } from '../../src/core/validation.js';
import { validateSchema } from './openapi';

describe('contract: Error schema compliance', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    app.get('/test/contract-unauth', { preHandler: [app.authenticate] }, async () => ({ ok: true }));
    app.post('/test/contract-validate', async (req) => {
      validate(z.object({ field: z.string().min(5) }), req.body);
      return { ok: true };
    });
    app.get('/test/contract-not-found', async () => { throw notFound(); });
    app.get('/test/contract-conflict', async () => { throw conflict('Item conflict', 'GROUP_FULL'); });
    app.get('/test/contract-server-error', async () => { throw new Error('Unhandled'); });
  });

  afterAll(() => app.close());

  it('404 response matches OpenAPI Error schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const { valid, errors } = validateSchema('Error', res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('401 response matches OpenAPI Error schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/contract-unauth' });
    expect(res.statusCode).toBe(401);
    const { valid, errors } = validateSchema('Error', res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('422 validation response matches OpenAPI Error schema with details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/contract-validate',
      payload: { field: 'no' },
    });
    expect(res.statusCode).toBe(422);
    const { valid, errors } = validateSchema('Error', res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('409 conflict response matches OpenAPI Error schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/contract-conflict' });
    expect(res.statusCode).toBe(409);
    const { valid, errors } = validateSchema('Error', res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('500 internal error response matches OpenAPI Error schema', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/contract-server-error' });
    expect(res.statusCode).toBe(500);
    const { valid, errors } = validateSchema('Error', res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
