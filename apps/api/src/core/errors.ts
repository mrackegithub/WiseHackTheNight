export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ path?: string; issue?: string }>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message = 'Resource not found', code = 'NOT_FOUND'): HttpError {
  return new HttpError(404, code, message);
}

export function unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED'): HttpError {
  return new HttpError(401, code, message);
}

export function forbidden(message = 'Forbidden', code = 'FORBIDDEN'): HttpError {
  return new HttpError(403, code, message);
}

export function conflict(message = 'Conflict', code = 'CONFLICT'): HttpError {
  return new HttpError(409, code, message);
}

export function validationError(
  message = 'Request validation failed',
  details?: Array<{ path?: string; issue?: string }>,
): HttpError {
  return new HttpError(422, 'VALIDATION_FAILED', message, details);
}

export function badRequest(message = 'Bad request', code = 'BAD_REQUEST'): HttpError {
  return new HttpError(400, code, message);
}
