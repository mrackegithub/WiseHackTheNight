import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../core/validation.js';
import {
  getCandidatesQuerySchema,
  swipeRequestSchema,
  listMatchesQuerySchema,
} from './matching.schemas.js';
import * as matchingService from './matching.service.js';

type CandidatesResponse = paths['/matching/candidates']['get']['responses'][200]['content']['application/json'];
type SwipeResponse = paths['/matching/swipes']['post']['responses'][200]['content']['application/json'];
type MatchesResponse = paths['/matching/matches']['get']['responses'][200]['content']['application/json'];

const matchingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/matching/candidates', { preHandler: [app.authenticate] }, async (req): Promise<CandidatesResponse> => {
    const query = validate(getCandidatesQuerySchema, req.query);
    return matchingService.getCandidates(app.prisma, req.user.sub, query);
  });

  app.post('/matching/swipes', { preHandler: [app.authenticate] }, async (req): Promise<SwipeResponse> => {
    const body = validate(swipeRequestSchema, req.body);
    return matchingService.swipe(app.prisma, req.user.sub, body);
  });

  app.get('/matching/matches', { preHandler: [app.authenticate] }, async (req): Promise<MatchesResponse> => {
    const query = validate(listMatchesQuerySchema, req.query);
    return matchingService.listMatches(app.prisma, req.user.sub, query);
  });
};

export default matchingRoutes;
