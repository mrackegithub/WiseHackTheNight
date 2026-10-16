import type { Schemas } from '@sgm/contracts';

export const roleLabels: Record<Schemas['RoleTag'], string> = {
  NEEDS_HELP: 'I need help',
  CAN_EXPLAIN: 'I can explain',
  PEER: 'Study as peers',
};

export const roleOrder: Schemas['RoleTag'][] = ['NEEDS_HELP', 'CAN_EXPLAIN', 'PEER'];

export const modeLabels: Record<Schemas['Preferences']['mode'], string> = {
  IN_PERSON: 'In person',
  ONLINE: 'Online',
  EITHER: 'Either',
};

export const locationTypeLabels: Record<Schemas['LocationType'], string> = {
  LIBRARY: 'Library',
  CAMPUS_ROOM: 'Campus room',
  CAFE: 'Café',
  COWORKING: 'Coworking space',
  OTHER: 'Other',
};

/** 90 -> "1 h 30 min", 60 -> "1 h", 45 -> "45 min" */
export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
