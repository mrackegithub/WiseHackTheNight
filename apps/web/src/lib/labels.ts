import type { Schemas } from '@sgm/contracts';

export const roleLabels: Record<Schemas['RoleTag'], string> = {
  NEEDS_HELP: 'I need help',
  CAN_EXPLAIN: 'I can explain',
  PEER: 'Study as peers',
};

export const roleOrder: Schemas['RoleTag'][] = ['NEEDS_HELP', 'CAN_EXPLAIN', 'PEER'];
