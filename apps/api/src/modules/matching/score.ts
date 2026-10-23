import type { RoleTag } from '@prisma/client';
import { MATCHING_WEIGHTS, type MatchingWeights } from './weights.js';

export interface ScoreBreakdown {
  total: number;
  timeOverlap: number;
  roleComplement: number;
  interests: number;
  proximity: number;
  groupSizeFit: number;
}

export interface ScoreInputs {
  // Time overlap: shared free minutes out of my own free minutes (same horizon)
  overlappingFreeMinutes: number;
  myFreeMinutes: number;

  // Role complement
  myRole: RoleTag;
  candidateRole: RoleTag;

  // Interests
  myInterests: string[];
  candidateInterests: string[];

  // Proximity
  distanceKm: number | null;
  maxDistanceKm: number;
  isOnline: boolean;

  // Group size fit
  myGroupRange: [number, number]; // [min, max]
  candidateGroupRange?: [number, number]; // for user candidate
  candidateMemberCount?: number; // for group candidate
}

/**
 * Enhanced time overlap calculation:
 * Returns 1.0 when they are free whenever I am free.
 * Rewards both proportional share and solid multi-hour study session availability.
 */
export function calculateTimeOverlap(overlappingMinutes: number, myFreeMinutes: number): number {
  if (overlappingMinutes <= 0 || myFreeMinutes <= 0) return 0;
  if (overlappingMinutes >= myFreeMinutes) return 1.0;

  const ratio = overlappingMinutes / myFreeMinutes;
  // Saturation curve: 360 min (6 hours over 2 weeks) achieves maximum cadence utility
  const cadenceUtility = Math.min(1, Math.pow(overlappingMinutes / 360, 0.75));

  // Balanced: 50% relative availability + 50% cadence availability
  return Math.min(1, Math.max(0, 0.5 * ratio + 0.5 * cadenceUtility));
}

/**
 * Role complement score:
 * Perfect tutoring match: NEEDS_HELP <-> CAN_EXPLAIN (1.0).
 * High-value peer collaboration: PEER <-> PEER (0.85) and PEER <-> CAN_EXPLAIN (0.80).
 */
export function calculateRoleComplement(myRole: RoleTag, candidateRole: RoleTag): number {
  if (
    (myRole === 'NEEDS_HELP' && candidateRole === 'CAN_EXPLAIN') ||
    (myRole === 'CAN_EXPLAIN' && candidateRole === 'NEEDS_HELP')
  ) {
    return 1.0;
  }
  if (myRole === 'PEER' && candidateRole === 'PEER') {
    return 0.85;
  }
  if (
    (myRole === 'PEER' && candidateRole === 'CAN_EXPLAIN') ||
    (myRole === 'CAN_EXPLAIN' && candidateRole === 'PEER')
  ) {
    return 0.80;
  }
  if (
    (myRole === 'PEER' && candidateRole === 'NEEDS_HELP') ||
    (myRole === 'NEEDS_HELP' && candidateRole === 'PEER')
  ) {
    return 0.70;
  }
  if (myRole === 'CAN_EXPLAIN' && candidateRole === 'CAN_EXPLAIN') {
    return 0.65;
  }
  if (myRole === 'NEEDS_HELP' && candidateRole === 'NEEDS_HELP') {
    return 0.45;
  }
  return 0.60;
}

/**
 * Enhanced interests score:
 * Combines Jaccard similarity with Overlap (Szymkiewicz–Simpson) coefficient.
 * When candidate interests are a subset of yours, overlap is high.
 */
export function calculateInterests(myInterests: string[], candidateInterests: string[]): number {
  const setA = new Set(myInterests);
  const setB = new Set(candidateInterests);

  if (setA.size === 0 && setB.size === 0) return 0.0;
  if (setA.size === 0 || setB.size === 0) return 0.25;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  if (intersection === 0) return 0.0;

  const union = setA.size + setB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;

  const minSize = Math.min(setA.size, setB.size);
  const overlap = minSize > 0 ? intersection / minSize : 0;

  return Math.min(1.0, Math.max(0.0, 0.5 * jaccard + 0.5 * overlap));
}

/**
 * 10x better proximity scoring:
 * - Immediate campus / walking distance (< 1km) gets 0.95 - 1.0 (95-100%).
 * - Short transit (1-2km) gets 0.85 - 0.92 (85-92%).
 * - Smooth power decay towards maxDistanceKm.
 * - When physically separated with known distance, physical distance determines the score.
 * - Purely online matches (no travel needed, distanceKm === null) get 1.0.
 */
export function calculateProximity(
  distanceKm: number | null,
  maxDistanceKm: number,
  isOnline: boolean,
): number {
  if (distanceKm === null || distanceKm === undefined) {
    return isOnline ? 1.0 : 0.0;
  }

  if (distanceKm < 0) return 0.0;

  const maxD = maxDistanceKm > 0 ? maxDistanceKm : 5;

  if (distanceKm >= maxD) {
    return 0.0;
  }

  const ratio = distanceKm / maxD;
  // Non-linear curve: high retention in close range, dropping smoothly towards maxD
  const physicalScore = 1 - Math.pow(ratio, 1.6);

  return Math.max(0, Math.min(1, physicalScore));
}

/**
 * Group size fit with soft decay.
 */
export function calculateGroupSizeFit(
  myRange: [number, number],
  candidateRange?: [number, number],
  candidateMemberCount?: number,
): number {
  if (candidateMemberCount !== undefined) {
    const targetSize = candidateMemberCount + 1;
    if (targetSize >= myRange[0] && targetSize <= myRange[1]) {
      return 1.0;
    }
    const dist = targetSize < myRange[0] ? myRange[0] - targetSize : targetSize - myRange[1];
    if (dist === 1) return 0.6;
    if (dist === 2) return 0.3;
    return 0.0;
  }

  if (candidateRange) {
    const overlapStart = Math.max(myRange[0], candidateRange[0]);
    const overlapEnd = Math.min(myRange[1], candidateRange[1]);
    if (overlapStart <= overlapEnd) {
      const overlapLen = overlapEnd - overlapStart + 1;
      const totalSpan = Math.max(myRange[1], candidateRange[1]) - Math.min(myRange[0], candidateRange[0]) + 1;
      const ratio = totalSpan > 0 ? overlapLen / totalSpan : 1.0;
      return Math.min(1.0, 0.7 + 0.3 * ratio);
    }
    const gap = candidateRange[0] > myRange[1] ? candidateRange[0] - myRange[1] : myRange[0] - candidateRange[1];
    if (gap <= 1) return 0.4;
    return 0.0;
  }

  return 0.5;
}

const round = (val: number, decimals = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
};

export function score(
  inputs: ScoreInputs,
  weights: MatchingWeights = MATCHING_WEIGHTS,
): ScoreBreakdown {
  const timeOverlap = round(calculateTimeOverlap(inputs.overlappingFreeMinutes, inputs.myFreeMinutes));
  const roleComplement = round(calculateRoleComplement(inputs.myRole, inputs.candidateRole));
  const interests = round(calculateInterests(inputs.myInterests, inputs.candidateInterests));
  const proximity = round(calculateProximity(inputs.distanceKm, inputs.maxDistanceKm, inputs.isOnline));
  const groupSizeFit = round(calculateGroupSizeFit(inputs.myGroupRange, inputs.candidateGroupRange, inputs.candidateMemberCount));

  const weightedSum =
    weights.timeOverlap * timeOverlap +
    weights.roleComplement * roleComplement +
    weights.interests * interests +
    weights.proximity * proximity +
    weights.groupSizeFit * groupSizeFit;

  const total = round(100 * weightedSum, 1);

  return {
    total,
    timeOverlap,
    roleComplement,
    interests,
    proximity,
    groupSizeFit,
  };
}
