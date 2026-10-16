import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import { getCandidatesQuerySchema } from './matching.schemas.js';
import * as matchingService from './matching.service.js';

type CandidatesResponse = paths['/matching/candidates']['get']['responses'][200]['content']['application/json'];

const matchingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/matching/candidates', { preHandler: [app.authenticate] }, async (req): Promise<CandidatesResponse> => {
    const query = validate(getCandidatesQuerySchema, req.query);
    return matchingService.getCandidates(app.prisma, req.user.sub, query);
  });
};

export default matchingRoutes;
