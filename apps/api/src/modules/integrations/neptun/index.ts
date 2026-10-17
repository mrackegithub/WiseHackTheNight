import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../../core/validation.js';
import {
  connectNeptunSchema,
  eventIdParamsSchema,
  manualEventSchema,
  replaceAvailabilitySchema,
  scheduleQuerySchema,
} from './neptun.schemas.js';
import * as availabilityService from './availability.service.js';
import * as neptunService from './neptun.service.js';

type NeptunStatusResponse =
  paths['/integrations/neptun']['get']['responses'][200]['content']['application/json'];
type SyncResultResponse =
  paths['/integrations/neptun/sync']['post']['responses'][200]['content']['application/json'];
type ScheduleResponse =
  paths['/me/schedule']['get']['responses'][200]['content']['application/json'];
type AvailabilityGetResponse =
  paths['/me/availability']['get']['responses'][200]['content']['application/json'];
type AvailabilityPutResponse =
  paths['/me/availability']['put']['responses'][200]['content']['application/json'];

function extractIcsFromPayload(payload: Buffer | string | unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (Buffer.isBuffer(payload)) {
    const text = payload.toString('utf8');
    const vcalStart = text.indexOf('BEGIN:VCALENDAR');
    const vcalEnd = text.lastIndexOf('END:VCALENDAR');
    if (vcalStart !== -1 && vcalEnd !== -1 && vcalEnd > vcalStart) {
      return text.slice(vcalStart, vcalEnd + 'END:VCALENDAR'.length);
    }
    return text;
  }
  return '';
}

const neptunRoutes: FastifyPluginAsync = async (app) => {
  // Allow multipart/form-data and text/calendar for uploads
  app.addContentTypeParser(
    ['multipart/form-data', 'text/calendar'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  // Background 6-hourly periodic re-sync
  neptunService.startPeriodicNeptunResync(app.prisma);
  app.addHook('onClose', () => {
    neptunService.stopPeriodicNeptunResync();
  });

  // GET /integrations/neptun
  app.get(
    '/integrations/neptun',
    { preHandler: [app.authenticate] },
    async (req): Promise<NeptunStatusResponse> => {
      return neptunService.getNeptunStatus(app.prisma, req.user.sub);
    },
  );

  // PUT /integrations/neptun
  app.put(
    '/integrations/neptun',
    { preHandler: [app.authenticate] },
    async (req): Promise<NeptunStatusResponse> => {
      const { icsUrl } = validate(connectNeptunSchema, req.body);
      return neptunService.connectNeptun(app.prisma, req.user.sub, icsUrl);
    },
  );

  // DELETE /integrations/neptun
  app.delete(
    '/integrations/neptun',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      await neptunService.disconnectNeptun(app.prisma, req.user.sub);
      return reply.status(204).send();
    },
  );

  // POST /integrations/neptun/sync
  app.post(
    '/integrations/neptun/sync',
    { preHandler: [app.authenticate] },
    async (req): Promise<SyncResultResponse> => {
      return neptunService.syncNeptun(app.prisma, req.user.sub);
    },
  );

  // POST /integrations/neptun/upload
  app.post(
    '/integrations/neptun/upload',
    { preHandler: [app.authenticate] },
    async (req): Promise<SyncResultResponse> => {
      const icsText = extractIcsFromPayload(req.body);
      return neptunService.uploadNeptunIcs(app.prisma, req.user.sub, icsText);
    },
  );

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

  // POST /me/schedule: manual busy blocks (not from Neptun)
  app.post(
    '/me/schedule',
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<ScheduleResponse> => {
      const input = validate(manualEventSchema, req.body);
      reply.code(201);
      return availabilityService.createManualEvents(app.prisma, req.user.sub, input);
    },
  );

  // DELETE /me/schedule/:eventId (own MANUAL events only)
  app.delete(
    '/me/schedule/:eventId',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { eventId } = validate(eventIdParamsSchema, req.params);
      await availabilityService.deleteManualEvent(app.prisma, req.user.sub, eventId);
      return reply.code(204).send();
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
