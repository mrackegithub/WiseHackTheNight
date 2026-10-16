import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import { listSubjectsQuerySchema } from './subjects.schemas.js';
import * as subjectsService from './subjects.service.js';

type InterestsResponse = paths['/interests']['get']['responses'][200]['content']['application/json'];
type SubjectsResponse = paths['/subjects']['get']['responses'][200]['content']['application/json'];

const subjectsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/interests', async (): Promise<InterestsResponse> => {
    return subjectsService.listInterests(app.prisma);
  });

  app.get('/subjects', async (req): Promise<SubjectsResponse> => {
    const query = validate(listSubjectsQuerySchema, req.query);
    return subjectsService.listSubjects(app.prisma, query);
  });
};

export default subjectsRoutes;
