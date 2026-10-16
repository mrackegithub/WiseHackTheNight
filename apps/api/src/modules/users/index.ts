import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import {
  geoPointInputSchema,
  preferencesSchema,
  replaceSubjectsSchema,
  updateMeSchema,
} from './users.schemas.js';
import * as usersService from './users.service.js';

type MeResponse = paths['/me']['get']['responses'][200]['content']['application/json'];
type SubjectsResponse = paths['/me/subjects']['get']['responses'][200]['content']['application/json'];
type PreferencesResponse = paths['/me/preferences']['get']['responses'][200]['content']['application/json'];
type LocationResponse = paths['/me/location']['put']['responses'][200]['content']['application/json'];

const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: [app.authenticate] }, async (req): Promise<MeResponse> => {
    return usersService.getMe(app.prisma, req.user.sub);
  });

  app.patch('/me', { preHandler: [app.authenticate] }, async (req): Promise<MeResponse> => {
    const input = validate(updateMeSchema, req.body);
    return usersService.updateMe(app.prisma, req.user.sub, input);
  });

  app.get('/me/subjects', { preHandler: [app.authenticate] }, async (req): Promise<SubjectsResponse> => {
    return usersService.getMySubjects(app.prisma, req.user.sub);
  });

  app.put('/me/subjects', { preHandler: [app.authenticate] }, async (req): Promise<SubjectsResponse> => {
    const input = validate(replaceSubjectsSchema, req.body);
    return usersService.replaceMySubjects(app.prisma, req.user.sub, input);
  });

  app.get('/me/preferences', { preHandler: [app.authenticate] }, async (req): Promise<PreferencesResponse> => {
    return usersService.getMyPreferences(app.prisma, req.user.sub);
  });

  app.put('/me/preferences', { preHandler: [app.authenticate] }, async (req): Promise<PreferencesResponse> => {
    const input = validate(preferencesSchema, req.body);
    return usersService.updateMyPreferences(app.prisma, req.user.sub, input);
  });

  app.put('/me/location', { preHandler: [app.authenticate] }, async (req): Promise<LocationResponse> => {
    const input = validate(geoPointInputSchema, req.body);
    return usersService.updateMyLocation(app.prisma, req.user.sub, input);
  });
};

export default usersRoutes;
