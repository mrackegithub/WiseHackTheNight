import type { Schemas } from '@sgm/contracts';

export type EventCategory = Schemas['EventCategory'];

/** Category choices for a manual busy time, in display order. */
export const categoryOptions: { value: EventCategory; label: string; swatch: string }[] = [
  { value: 'CLASS', label: 'Class', swatch: 'bg-blue-600' },
  { value: 'STUDY', label: 'Study session', swatch: 'bg-orange-500' },
  { value: 'WORK', label: 'Work', swatch: 'bg-violet-600' },
  { value: 'OTHER', label: 'Other', swatch: 'bg-slate-600' },
];

const byCategory = Object.fromEntries(categoryOptions.map((o) => [o.value, o])) as Record<EventCategory, (typeof categoryOptions)[number]>;

/** How a calendar event is labelled and coloured: Neptun classes are blue, study sessions orange, manual ones by category. */
export function eventStyle(event: Pick<Schemas['CalendarEvent'], 'source' | 'category'>) {
  if (event.source === 'NEPTUN') return { label: 'Class (Neptun)', className: `${byCategory.CLASS.swatch} text-white` };
  if (event.source === 'STUDY_SESSION') return { label: 'Group study session', className: `${byCategory.STUDY.swatch} text-white` };
  const c = byCategory[event.category ?? 'OTHER'];
  return { label: c.label, className: `${c.swatch} text-white` };
}
