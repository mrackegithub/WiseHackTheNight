import type { ZodType, z } from 'zod';
import { validationError } from './errors.js';

export function validate<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      issue: issue.message,
    }));
    throw validationError('Request validation failed', details);
  }
  return result.data;
}
