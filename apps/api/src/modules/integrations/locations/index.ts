import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../../core/validation.js';
import {
  geocodeQuerySchema,
  groupIdParamsSchema,
  listLocationsQuerySchema,
  suggestedLocationsQuerySchema,
} from './locations.schemas.js';
import * as locationsService from './locations.service.js';

type LocationsResponse =
  paths['/locations']['get']['responses'][200]['content']['application/json'];
type GeocodeResponse =
  paths['/locations/geocode']['get']['responses'][200]['content']['application/json'];
type SuggestedLocationsResponse =
  paths['/groups/{groupId}/suggested-locations']['get']['responses'][200]['content']['application/json'];

const locationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /locations
  app.get('/locations', async (req): Promise<LocationsResponse> => {
    const query = validate(listLocationsQuerySchema, req.query);
    return locationsService.listLocations(app.prisma, query);
  });

  // GET /locations/geocode
  app.get('/locations/geocode', async (req): Promise<GeocodeResponse> => {
    const query = validate(geocodeQuerySchema, req.query);
    return locationsService.geocodeAddress(query);
  });

  // GET /groups/:groupId/suggested-locations
  app.get(
    '/groups/:groupId/suggested-locations',
    { preHandler: [app.authenticate] },
    async (req): Promise<SuggestedLocationsResponse> => {
      const { groupId } = validate(groupIdParamsSchema, req.params);
      const query = validate(suggestedLocationsQuerySchema, req.query);
      return locationsService.getGroupSuggestedLocations(app.prisma, groupId, query);
    },
  );
};

export default locationsRoutes;
