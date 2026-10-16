import type { Schemas } from '@sgm/contracts';

type ErrorDetail = NonNullable<Schemas['Error']['details']>[number];

/** Every failed API call becomes an ApiError. The UI switches on `code`, never on `message`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isContractError(body: unknown): body is Schemas['Error'] {
  return typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string';
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isContractError(body)) return new ApiError(status, body.code, body.message ?? '', body.details ?? []);
  return new ApiError(status, `HTTP_${status}`, `Request failed with status ${status}`);
}

/** Awaits an openapi-fetch call and returns `data`, or throws an ApiError. */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : 'Network error');
  }
  if (!result.response.ok) throw toApiError(result.response.status, result.error);
  return result.data as T;
}
