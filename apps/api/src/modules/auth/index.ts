import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

type RegisterResponse = paths['/auth/register']['post']['responses'][201]['content']['application/json'];
type LoginResponse = paths['/auth/login']['post']['responses'][200]['content']['application/json'];
type RefreshResponse = paths['/auth/refresh']['post']['responses'][200]['content']['application/json'];

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/register', async (req, reply): Promise<RegisterResponse> => {
    const input = validate(registerSchema, req.body);
    const tokens = await authService.register(app.prisma, app.jwt, input);
    reply.status(201);
    return tokens;
  });

  app.post('/auth/login', async (req): Promise<LoginResponse> => {
    const input = validate(loginSchema, req.body);
    return authService.login(app.prisma, app.jwt, input);
  });

  app.post('/auth/refresh', async (req): Promise<RefreshResponse> => {
    const input = validate(refreshSchema, req.body);
    return authService.refresh(app.prisma, app.jwt, input);
  });
};

export default authRoutes;
