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

export const connectNeptunSchema = z.object({
  icsUrl: z.string().min(1, { message: 'icsUrl is required' }),
});

export const manualEventSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'title is required' }).max(120),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    repeatWeeks: z.number().int().min(0).max(16).default(0),
    category: z.enum(['CLASS', 'STUDY', 'WORK', 'OTHER']).default('OTHER'),
  })
  .refine((d) => new Date(d.start).getTime() < new Date(d.end).getTime(), { message: 'end must be after start', path: ['end'] })
  .refine((d) => new Date(d.end).getTime() - new Date(d.start).getTime() <= 24 * 60 * 60 * 1000, {
    message: 'a busy block can be at most 24 hours long',
    path: ['end'],
  });

export const eventIdParamsSchema = z.object({ eventId: z.string().uuid() });

export type ManualEventInput = z.infer<typeof manualEventSchema>;
export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
export type WeeklyWindowInput = z.infer<typeof weeklyWindowSchema>;
export type ConnectNeptunInput = z.infer<typeof connectNeptunSchema>;
