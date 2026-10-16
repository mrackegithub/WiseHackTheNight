import { ApiError } from '../api/errors';

/** Turns a VALIDATION_FAILED error's `details` into `{ field: issue }` for inline form errors. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return {};
  const result: Record<string, string> = {};
  for (const d of error.details) {
    // Paths may look like "email", "/email" or "body.email"; key on the last segment.
    const field = d.path?.split(/[./]/).filter(Boolean).pop();
    if (field && !result[field]) result[field] = d.issue ?? 'Invalid value';
  }
  return result;
}
