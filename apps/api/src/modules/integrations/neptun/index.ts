import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../../core/validation.js';
import {
  replaceAvailabilitySchema,
  scheduleQuerySchema,
} from './neptun.schemas.js';
import * as availabilityService from './availability.service.js';

type ScheduleResponse =
  paths['/me/schedule']['get']['responses'][200]['content']['application/json'];
type AvailabilityGetResponse =
  paths['/me/availability']['get']['responses'][200]['content']['application/json'];
type AvailabilityPutResponse =
  paths['/me/availability']['put']['responses'][200]['content']['application/json'];

const neptunRoutes: FastifyPluginAsync = async (app) => {
  // GET /me/schedule
  app.get(
    '/me/schedule',
    { preHandler: [app.authenticate] },
    async (req): Promise<ScheduleResponse> => {
      const { from, to } = validate(scheduleQuerySchema, req.query);
      return availabilityService.getMySchedule(
        app.prisma,
        req.user.sub,
        new Date(from),
        new Date(to),
      );
    },
  );

  // GET /me/availability
  app.get(
    '/me/availability',
    { preHandler: [app.authenticate] },
    async (req): Promise<AvailabilityGetResponse> => {
      const { from, to } = validate(scheduleQuerySchema, req.query);
      return availabilityService.getMyAvailability(
        app.prisma,
        req.user.sub,
        new Date(from),
        new Date(to),
      );
    },
  );

  // PUT /me/availability
  app.put(
    '/me/availability',
    { preHandler: [app.authenticate] },
    async (req): Promise<AvailabilityPutResponse> => {
      const windows = validate(replaceAvailabilitySchema, req.body);
      return availabilityService.replaceMyAvailabilityWindows(
        app.prisma,
        req.user.sub,
        windows,
      );
    },
  );
};

export default neptunRoutes;

