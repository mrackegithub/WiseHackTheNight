import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { validateResponse } from './openapi.js';

describe('contract: auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({
      where: { email: { contains: 'contract-auth-' } },
    });
    await app.close();
  });

  const uniqueEmail = () => `contract-auth-${Date.now()}-${Math.random().toString(36).substring(7)}@sgm.local`;

  it('POST /auth/register 201 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(),
        password: 'password123',
        displayName: 'Contract Test User',
      },
    });

    expect(res.statusCode).toBe(201);
    const { valid, errors } = validateResponse('/auth/register', 'post', 201, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/register 422 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'invalid',
        password: 'short',
        displayName: '',
      },
    });

    expect(res.statusCode).toBe(422);
    const { valid, errors } = validateResponse('/auth/register', 'post', 422, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/register 409 matches OpenAPI schema', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'User 1' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'User 2' },
    });

    expect(res.statusCode).toBe(409);
    const { valid, errors } = validateResponse('/auth/register', 'post', 409, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/login 200 matches OpenAPI schema', async () => {
    const email = uniqueEmail();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'password123', displayName: 'Login Contract' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/auth/login', 'post', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/login 401 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nonexistent@sgm.local', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    const { valid, errors } = validateResponse('/auth/login', 'post', 401, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/refresh 200 matches OpenAPI schema', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: uniqueEmail(), password: 'password123', displayName: 'Refresh Contract' },
    });
    const { refreshToken } = regRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const { valid, errors } = validateResponse('/auth/refresh', 'post', 200, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('POST /auth/refresh 401 matches OpenAPI schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'non-existent' },
    });

    expect(res.statusCode).toBe(401);
    const { valid, errors } = validateResponse('/auth/refresh', 'post', 401, res.json());
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });
});
