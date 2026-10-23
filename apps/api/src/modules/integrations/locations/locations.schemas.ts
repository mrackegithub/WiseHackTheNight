import { z } from 'zod';

export const locationTypeEnum = z.enum([
  'LIBRARY',
  'CAMPUS_ROOM',
  'CAFE',
  'COWORKING',
  'OTHER',
]);

export const listLocationsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(50).default(3),
  type: locationTypeEnum.optional(),
});

export const geocodeQuerySchema = z.object({
  q: z.string().min(3, { message: "Query 'q' must have at least 3 characters" }),
});

export const suggestedLocationsQuerySchema = z.object({
  type: locationTypeEnum.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const groupIdParamsSchema = z.object({
  groupId: z.string().uuid(),
});

export type ListLocationsQuery = z.infer<typeof listLocationsQuerySchema>;
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;
export type SuggestedLocationsQuery = z.infer<typeof suggestedLocationsQuerySchema>;
export type GroupIdParams = z.infer<typeof groupIdParamsSchema>;
