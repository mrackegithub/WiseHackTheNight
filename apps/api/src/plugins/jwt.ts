import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../core/errors.js';

export interface UserTokenPayload {
  sub: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserTokenPayload;
    user: UserTokenPayload;
  }
}

export default fp(
  async (app) => {
    const secret = process.env.JWT_SECRET ?? 'change-me-default-jwt-secret-key-32bytes';
    await app.register(jwt, {
      secret,
      sign: {
        expiresIn: '15m',
      },
    });

    app.decorate(
      'authenticate',
      async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
        try {
          await request.jwtVerify();
        } catch {
          throw unauthorized('Missing or invalid authorization token');
        }
      },
    );
  },
  { name: 'jwt' },
);
