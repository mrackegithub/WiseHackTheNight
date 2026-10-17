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
 * How much of my free time the candidate is also free: 1 = whenever I can study, they can too.
 * (A fixed target such as "3 sessions' worth" saturates for nearly every pair over 14 days.)
 */
export function calculateTimeOverlap(overlappingMinutes: number, myFreeMinutes: number): number {
  if (overlappingMinutes <= 0 || myFreeMinutes <= 0) return 0;
  return Math.min(1, overlappingMinutes / myFreeMinutes);
}

export function calculateRoleComplement(myRole: RoleTag, candidateRole: RoleTag): number {
  if (
    (myRole === 'NEEDS_HELP' && candidateRole === 'CAN_EXPLAIN') ||
    (myRole === 'CAN_EXPLAIN' && candidateRole === 'NEEDS_HELP')
  ) {
    return 1.0;
  }
  if (myRole === 'PEER' && candidateRole === 'PEER') {
    return 0.7;
  }
  if (myRole === 'PEER' || candidateRole === 'PEER') {
    return 0.5;
  }
  if (myRole === 'CAN_EXPLAIN' && candidateRole === 'CAN_EXPLAIN') {
    return 0.4;
  }
  if (myRole === 'NEEDS_HELP' && candidateRole === 'NEEDS_HELP') {
    return 0.3;
  }
  return 0.5;
}

export function calculateInterests(myInterests: string[], candidateInterests: string[]): number {
  const setA = new Set(myInterests);
  const setB = new Set(candidateInterests);

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function calculateProximity(
  distanceKm: number | null,
  maxDistanceKm: number,
  isOnline: boolean,
): number {
  if (isOnline) return 1.0;
  if (distanceKm === null || distanceKm < 0) return 0.0;
  if (maxDistanceKm <= 0) return 0.0;
  const score = 1 - distanceKm / maxDistanceKm;
  return Math.max(0, Math.min(1, score));
}

export function calculateGroupSizeFit(
  myRange: [number, number],
  candidateRange?: [number, number],
  candidateMemberCount?: number,
): number {
  if (candidateMemberCount !== undefined) {
    const targetSize = candidateMemberCount + 1;
    return targetSize >= myRange[0] && targetSize <= myRange[1] ? 1.0 : 0.0;
  }

  if (candidateRange) {
    const overlapStart = Math.max(myRange[0], candidateRange[0]);
    const overlapEnd = Math.min(myRange[1], candidateRange[1]);
    if (overlapStart > overlapEnd) return 0.0;
    const overlapLen = overlapEnd - overlapStart + 1;
    const totalSpan = Math.max(myRange[1], candidateRange[1]) - Math.min(myRange[0], candidateRange[0]) + 1;
    return totalSpan > 0 ? overlapLen / totalSpan : 0.0;
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
