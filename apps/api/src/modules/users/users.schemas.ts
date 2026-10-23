import { z } from 'zod';

export const updateMeSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(300).nullable().optional(),
  avatarUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  university: z.string().nullable().optional(),
  faculty: z.string().nullable().optional(),
  interestIds: z.array(z.string().uuid()).max(15).optional(),
});

export const roleTagSchema = z.enum(['NEEDS_HELP', 'CAN_EXPLAIN', 'PEER']);

export const userSubjectInputSchema = z.object({
  subjectId: z.string().uuid(),
  role: roleTagSchema,
  confidence: z.number().int().min(1).max(5).default(3),
});

export const replaceSubjectsSchema = z
  .array(userSubjectInputSchema)
  .max(30)
  .refine((items) => new Set(items.map((i) => i.subjectId)).size === items.length, {
    message: 'Duplicate subjects are not allowed',
    path: ['subjectId'],
  });

export const locationTypeEnum = z.enum(['LIBRARY', 'CAMPUS_ROOM', 'CAFE', 'COWORKING', 'OTHER']);
export const studyModeEnum = z.enum(['IN_PERSON', 'ONLINE', 'EITHER']);

export const preferencesSchema = z.object({
  groupSizeMin: z.number().int().min(2).max(10).default(2),
  groupSizeMax: z.number().int().min(2).max(10).default(4),
  maxDistanceKm: z.number().min(0.5).max(50).default(5),
  sessionLengthMinutes: z.number().int().min(30).max(240).default(90),
  locationTypes: z.array(locationTypeEnum),
  mode: studyModeEnum.default('EITHER'),
}).refine((data) => data.groupSizeMax >= data.groupSizeMin, {
  message: 'groupSizeMax must be greater than or equal to groupSizeMin',
  path: ['groupSizeMax'],
});

export const geoPointInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(120).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UserSubjectInput = z.infer<typeof userSubjectInputSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type GeoPointInput = z.infer<typeof geoPointInputSchema>;
