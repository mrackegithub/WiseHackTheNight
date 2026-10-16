import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('B2: Auth Module', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    // Clean up test users
    await app.prisma.user.deleteMany({
      where: { email: { contains: 'test-auth-' } },
    });
    await app.close();
  });

  const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@sgm.local`;

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      const email = uniqueEmail('test-auth-reg');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'securePassword123!',
          displayName: 'Test User',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json).toHaveProperty('accessToken');
      expect(json).toHaveProperty('refreshToken');
      expect(json.expiresIn).toBe(900);

      const decoded = app.jwt.decode<{ sub: string; email: string }>(json.accessToken);
      expect(decoded?.email).toBe(email);
      expect(decoded?.sub).toBeDefined();

      // Verify user in DB
      const user = await app.prisma.user.findUnique({
        where: { id: decoded?.sub },
        include: { preferences: true },
      });
      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
      expect(user?.preferences).toBeDefined();
    });

    it('rejects registration with short password (< 8 chars) with 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: uniqueEmail('test-auth-short'),
          password: 'short',
          displayName: 'Test',
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VALIDATION_FAILED');
    });

    it('rejects registration with invalid email with 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'password123',
          displayName: 'Test',
        },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('VALIDATION_FAILED');
    });

    it('rejects registration with existing email with 409', async () => {
      const email = uniqueEmail('test-auth-dup');
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'password123',
          displayName: 'First User',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'differentPassword123',
          displayName: 'Second User',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('EMAIL_ALREADY_REGISTERED');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in with correct credentials and returns tokens', async () => {
      const email = uniqueEmail('test-auth-login');
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'correctPassword123',
          displayName: 'Login Test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: email.toUpperCase(), // Case-insensitive test
          password: 'correctPassword123',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.accessToken).toBeDefined();
      expect(json.refreshToken).toBeDefined();
      expect(json.expiresIn).toBe(900);
    });

    it('rejects login with wrong password with 401', async () => {
      const email = uniqueEmail('test-auth-wrong-pwd');
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'correctPassword123',
          displayName: 'Wrong Pwd Test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email,
          password: 'wrongPassword123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login with non-existent user with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'does-not-exist@example.com',
          password: 'anyPassword123',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token and returns new tokens', async () => {
      const email = uniqueEmail('test-auth-refresh');
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'password123',
          displayName: 'Refresh Test',
        },
      });

      const { refreshToken: firstRefreshToken } = regRes.json();

      // Refresh tokens
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: firstRefreshToken },
      });

      expect(refreshRes.statusCode).toBe(200);
      const { accessToken: newAccessToken, refreshToken: secondRefreshToken, expiresIn } = refreshRes.json();
      expect(newAccessToken).toBeDefined();
      expect(secondRefreshToken).toBeDefined();
      expect(secondRefreshToken).not.toBe(firstRefreshToken);
      expect(expiresIn).toBe(900);

      // Re-using the old refresh token must fail (it has been rotated/revoked)
      const reusedRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: firstRefreshToken },
      });
      expect(reusedRes.statusCode).toBe(401);
      expect(reusedRes.json().code).toBe('INVALID_REFRESH_TOKEN');

      // The new refresh token works
      const secondRefreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: secondRefreshToken },
      });
      expect(secondRefreshRes.statusCode).toBe(200);
    });

    it('rejects invalid refresh token with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 'invalid-non-existent-token' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
