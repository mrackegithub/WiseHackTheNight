/**
 * Matching score component weights defined in ARCHITECTURE §4.2.
 * All weights sum to 1.0.
 */
export const MATCHING_WEIGHTS = {
  timeOverlap: 0.35,
  roleComplement: 0.25,
  interests: 0.15,
  proximity: 0.15,
  groupSizeFit: 0.10,
} as const;

export type MatchingWeights = typeof MATCHING_WEIGHTS;
