import type { Schemas } from '@sgm/contracts';
import { formatMinutes } from '../../lib/labels';
import { minutesBetween } from '../../lib/time';

/** Role tags from the other person's point of view. */
export const theirRole: Record<Schemas['RoleTag'], { label: string; className: string }> = {
  NEEDS_HELP: { label: 'Needs help', className: 'bg-amber-100 text-amber-800' },
  CAN_EXPLAIN: { label: 'Can explain', className: 'bg-emerald-100 text-emerald-800' },
  PEER: { label: 'Studies as a peer', className: 'bg-sky-100 text-sky-800' },
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** One-line "why you matched", e.g. "4 h 30 min shared free time · they can explain · 2 shared interests". */
export function matchSummary(c: Schemas['Candidate']) {
  const shared = c.sharedSlots.reduce((m, s) => m + minutesBetween(s.start, s.end), 0);
  const parts = [shared ? `${formatMinutes(shared)} shared free time` : 'no shared free time yet'];
  if (c.role === 'CAN_EXPLAIN') parts.push('they can explain');
  if (c.role === 'NEEDS_HELP') parts.push('they need help');
  const n = c.sharedInterests?.length ?? 0;
  if (n) parts.push(`${n} shared interest${n === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
