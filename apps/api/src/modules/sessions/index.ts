import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import {
  createSessionSchema,
  groupIdParamsSchema,
  sessionParamsSchema,
} from './sessions.schemas.js';
import * as sessionsService from './sessions.service.js';

type ListSessionsResponse = paths['/groups/{groupId}/sessions']['get']['responses'][200]['content']['application/json'];
type CreateSessionResponse = paths['/groups/{groupId}/sessions']['post']['responses'][201]['content']['application/json'];

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/groups/:groupId/sessions', { preHandler: [app.authenticate] }, async (req): Promise<ListSessionsResponse> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    return sessionsService.listGroupSessions(app.prisma, groupId);
  });

  app.post('/groups/:groupId/sessions', { preHandler: [app.authenticate] }, async (req, reply): Promise<CreateSessionResponse> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    const body = validate(createSessionSchema, req.body);
    const session = await sessionsService.createGroupSession(app.prisma, req.user.sub, groupId, body);
    reply.status(201);
    return session;
  });

  app.delete('/groups/:groupId/sessions/:sessionId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { groupId, sessionId } = validate(sessionParamsSchema, req.params);
    await sessionsService.cancelGroupSession(app.prisma, req.user.sub, groupId, sessionId);
    return reply.status(204).send();
  });
};

export default sessionsRoutes;

