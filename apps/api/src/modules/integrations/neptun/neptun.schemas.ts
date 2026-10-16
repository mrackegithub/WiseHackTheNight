import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).or(z.string().datetime()),
    to: z.string().datetime({ offset: true }).or(z.string().datetime()),
  })
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      return fromDate.getTime() < toDate.getTime();
    },
    { message: "'from' date must be strictly before 'to' date", path: ['from'] },
  )
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      const maxMs = 31 * 24 * 60 * 60 * 1000;
      return toDate.getTime() - fromDate.getTime() <= maxMs;
    },
    { message: "Range between 'from' and 'to' cannot exceed 31 days", path: ['to'] },
  );

export const weeklyWindowSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    startTime: z.string().regex(timeRegex, { message: "Must be 'HH:mm' format" }),
    endTime: z.string().regex(timeRegex, { message: "Must be 'HH:mm' format" }),
  })
  .refine(
    (data) => data.startTime < data.endTime,
    { message: 'startTime must be before endTime', path: ['startTime'] },
  );

export const replaceAvailabilitySchema = z.array(weeklyWindowSchema);

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type WeeklyWindowInput = z.infer<typeof weeklyWindowSchema>;

