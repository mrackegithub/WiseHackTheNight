import type { FastifyPluginAsync } from 'fastify';
import type { paths } from '@sgm/contracts';
import { validate } from '../../../core/validation.js';
import {
  bookingParamsSchema,
  createBookingSchema,
  searchRoomsQuerySchema,
} from './rooms.schemas.js';
import * as roomsService from './rooms.service.js';

type RoomsResponse =
  paths['/rooms']['get']['responses'][200]['content']['application/json'];
type BookingResponse =
  paths['/bookings']['post']['responses'][201]['content']['application/json'];
type GetBookingResponse =
  paths['/bookings/{bookingId}']['get']['responses'][200]['content']['application/json'];

const roomsRoutes: FastifyPluginAsync = async (app) => {
  // GET /rooms
  app.get(
    '/rooms',
    { preHandler: [app.authenticate] },
    async (req): Promise<RoomsResponse> => {
      const query = validate(searchRoomsQuerySchema, req.query);
      return roomsService.searchRooms(app.prisma, query);
    },
  );

  // POST /bookings
  app.post(
    '/bookings',
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<BookingResponse> => {
      const body = validate(createBookingSchema, req.body);
      const result = await roomsService.createBooking(
        app.prisma,
        req.user.sub,
        body,
      );
      reply.status(201);
      return result;
    },
  );

  // GET /bookings/:bookingId
  app.get(
    '/bookings/:bookingId',
    { preHandler: [app.authenticate] },
    async (req): Promise<GetBookingResponse> => {
      const { bookingId } = validate(bookingParamsSchema, req.params);
      return roomsService.getBooking(app.prisma, bookingId);
    },
  );

  // DELETE /bookings/:bookingId
  app.delete(
    '/bookings/:bookingId',
    { preHandler: [app.authenticate] },
    async (req, reply): Promise<void> => {
      const { bookingId } = validate(bookingParamsSchema, req.params);
      await roomsService.cancelBooking(app.prisma, bookingId);
      reply.status(204);
    },
  );
};

export default roomsRoutes;
