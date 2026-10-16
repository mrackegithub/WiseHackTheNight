import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../src/app';
import { conflict, notFound, unauthorized } from '../src/core/errors.js';
import { validate } from '../src/core/validation.js';

describe('B1: Core Plugins', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Register a test route that exercises core plugins
    app.get('/test/protected', { preHandler: [app.authenticate] }, async (req) => {
      return { user: req.user };
    });

    app.post('/test/validate', async (req) => {
      const schema = z.object({
        name: z.string().min(3),
        email: z.string().email(),
      });
      const data = validate(schema, req.body);
      return { data };
    });

    app.get('/test/not-found-error', async () => {
      throw notFound('Custom item not found');
    });

    app.get('/test/conflict-error', async () => {
      throw conflict('Item already exists', 'CUSTOM_CONFLICT');
    });

    app.get('/test/unauthorized-error', async () => {
      throw unauthorized('Custom unauthorized');
    });

    app.get('/test/unhandled-error', async () => {
      throw new Error('Boom');
    });
  });

  afterAll(() => app.close());

  describe('Error handling', () => {
    it('returns 404 with contract Error shape for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/nonexistent' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        code: 'NOT_FOUND',
        message: 'Route not found',
      });
    });

    it('returns 404 with custom message for notFound()', async () => {
      const res = await app.inject({ method: 'GET', url: '/test/not-found-error' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        code: 'NOT_FOUND',
        message: 'Custom item not found',
      });
    });

    it('returns 409 with custom code for conflict()', async () => {
      const res = await app.inject({ method: 'GET', url: '/test/conflict-error' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        code: 'CUSTOM_CONFLICT',
        message: 'Item already exists',
      });
    });

    it('returns 401 with custom code for unauthorized()', async () => {
      const res = await app.inject({ method: 'GET', url: '/test/unauthorized-error' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Custom unauthorized',
      });
    });

    it('returns 500 with contract Error shape for unhandled errors', async () => {
      const res = await app.inject({ method: 'GET', url: '/test/unhandled-error' });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    });
  });

  describe('Zod validation', () => {
    it('passes valid payloads', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/test/validate',
        payload: { name: 'Alice', email: 'alice@example.com' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        data: { name: 'Alice', email: 'alice@example.com' },
      });
    });

    it('returns 422 with VALIDATION_FAILED and details for invalid payload', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/test/validate',
        payload: { name: 'A', email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(422);
      const json = res.json();
      expect(json.code).toBe('VALIDATION_FAILED');
      expect(json.message).toBe('Request validation failed');
      expect(json.details).toHaveLength(2);
      expect(json.details).toContainEqual({
        path: 'name',
        issue: expect.any(String),
      });
      expect(json.details).toContainEqual({
        path: 'email',
        issue: expect.any(String),
      });
    });
  });

  describe('JWT authentication', () => {
    it('rejects unauthenticated requests to protected routes with 401', async () => {
      const res = await app.inject({ method: 'GET', url: '/test/protected' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
      });
    });

    it('rejects invalid tokens with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: { authorization: 'Bearer invalid-token' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
      });
    });

    it('accepts valid JWT tokens signed with app.jwt', async () => {
      const token = app.jwt.sign({ sub: 'user-123', email: 'user@example.com' });
      const res = await app.inject({
        method: 'GET',
        url: '/test/protected',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.sub).toBe('user-123');
      expect(res.json().user.email).toBe('user@example.com');
    });
  });

  describe('CORS headers', () => {
    it('sets CORS headers on preflight requests', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });
});
