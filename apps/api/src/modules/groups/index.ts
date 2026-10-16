import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import {
  createGroupSchema,
  groupIdParamsSchema,
  suggestedSlotsQuerySchema,
} from './groups.schemas.js';
import * as groupsService from './groups.service.js';

type ListMyGroupsResponse = paths['/groups']['get']['responses'][200]['content']['application/json'];
type CreateGroupResponse = paths['/groups']['post']['responses'][201]['content']['application/json'];
type GetGroupResponse = paths['/groups/{groupId}']['get']['responses'][200]['content']['application/json'];
type JoinGroupResponse = paths['/groups/{groupId}/members']['post']['responses'][200]['content']['application/json'];
type SuggestedSlotsResponse = paths['/groups/{groupId}/suggested-slots']['get']['responses'][200]['content']['application/json'];

const groupsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/groups', { preHandler: [app.authenticate] }, async (req): Promise<ListMyGroupsResponse> => {
    return groupsService.listMyGroups(app.prisma, req.user.sub);
  });

  app.post('/groups', { preHandler: [app.authenticate] }, async (req, reply): Promise<CreateGroupResponse> => {
    const body = validate(createGroupSchema, req.body);
    const created = await groupsService.createGroup(app.prisma, req.user.sub, body);
    reply.status(201);
    return created;
  });

  app.get('/groups/:groupId', { preHandler: [app.authenticate] }, async (req): Promise<GetGroupResponse> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    return groupsService.getGroup(app.prisma, groupId);
  });

  app.post('/groups/:groupId/members', { preHandler: [app.authenticate] }, async (req): Promise<JoinGroupResponse> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    return groupsService.joinGroup(app.prisma, req.user.sub, groupId);
  });

  app.delete('/groups/:groupId/members', { preHandler: [app.authenticate] }, async (req, reply): Promise<void> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    await groupsService.leaveGroup(app.prisma, req.user.sub, groupId);
    reply.status(204).send();
  });

  app.get('/groups/:groupId/suggested-slots', { preHandler: [app.authenticate] }, async (req): Promise<SuggestedSlotsResponse> => {
    const { groupId } = validate(groupIdParamsSchema, req.params);
    const query = validate(suggestedSlotsQuerySchema, req.query);
    return groupsService.getGroupSuggestedSlots(app.prisma, groupId, query);
  });
};

export default groupsRoutes;

