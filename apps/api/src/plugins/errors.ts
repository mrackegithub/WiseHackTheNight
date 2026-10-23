import fp from 'fastify-plugin';
import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { HttpError } from '../core/errors.js';

export default fp(
  async (app) => {
    app.setNotFoundHandler((_request, reply) => {
      reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Route not found',
      });
    });

    app.setErrorHandler((error: FastifyError | Error | unknown, request, reply) => {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message,
          ...(error.details && error.details.length > 0 ? { details: error.details } : {}),
        });
      }

      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          issue: issue.message,
        }));
        return reply.status(422).send({
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details,
        });
      }

      const err = (typeof error === 'object' && error !== null ? error : {}) as {
        statusCode?: number;
        code?: string;
        message?: string;
        validation?: Array<{ instancePath?: string; message?: string }>;
      };

      // Fastify schema validation error fallback
      if (Array.isArray(err.validation)) {
        return reply.status(422).send({
          code: 'VALIDATION_FAILED',
          message: err.message || 'Request validation failed',
          details: err.validation.map((v) => ({
            path: v.instancePath || '',
            issue: v.message || 'invalid',
          })),
        });
      }

      // Prisma error mapping
      if (err.code === 'P2002') {
        return reply.status(409).send({
          code: 'CONFLICT',
          message: 'Resource already exists',
        });
      }

      if (err.code === 'P2025') {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Resource not found',
        });
      }

      if (err.code === 'P2003') {
        return reply.status(422).send({
          code: 'VALIDATION_FAILED',
          message: 'Foreign key constraint violation',
        });
      }

      // Handled status codes
      const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;

      if (statusCode === 401) {
        return reply.status(401).send({
          code: 'UNAUTHORIZED',
          message: err.message || 'Unauthorized',
        });
      }

      if (statusCode === 404) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: err.message || 'Not found',
        });
      }

      if (statusCode === 409) {
        return reply.status(409).send({
          code: err.code || 'CONFLICT',
          message: err.message || 'Conflict',
        });
      }

      if (statusCode < 500) {
        return reply.status(statusCode).send({
          code: err.code || 'BAD_REQUEST',
          message: err.message || 'Bad request',
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    });
  },
  { name: 'errors' },
);
