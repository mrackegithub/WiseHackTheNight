import { describe, expect, it } from 'vitest';
import {
  calculateGroupSizeFit,
  calculateInterests,
  calculateProximity,
  calculateRoleComplement,
  calculateTimeOverlap,
  score,
} from './score.js';
import { MATCHING_WEIGHTS } from './weights.js';

describe('B5: Matching Scoring Engine', () => {
  describe('Weights constant', () => {
    it('sums to 1.0', () => {
      const sum =
        MATCHING_WEIGHTS.timeOverlap +
        MATCHING_WEIGHTS.roleComplement +
        MATCHING_WEIGHTS.interests +
        MATCHING_WEIGHTS.proximity +
        MATCHING_WEIGHTS.groupSizeFit;
      expect(Math.round(sum * 100) / 100).toBe(1.0);
    });

    it('has correct individual weights as specified in ARCHITECTURE §4.2', () => {
      expect(MATCHING_WEIGHTS.timeOverlap).toBe(0.35);
      expect(MATCHING_WEIGHTS.roleComplement).toBe(0.25);
      expect(MATCHING_WEIGHTS.interests).toBe(0.15);
      expect(MATCHING_WEIGHTS.proximity).toBe(0.15);
      expect(MATCHING_WEIGHTS.groupSizeFit).toBe(0.10);
    });
  });

  describe('calculateTimeOverlap', () => {
    it('returns 0 when there are no overlapping minutes', () => {
      expect(calculateTimeOverlap(0, 90)).toBe(0);
      expect(calculateTimeOverlap(-10, 90)).toBe(0);
    });

    it('returns 1.0 when overlapping minutes equals 3x sessionLengthMinutes', () => {
      // 3 * 90 = 270 minutes
      expect(calculateTimeOverlap(270, 90)).toBe(1.0);
    });

    it('caps score at 1.0 when overlapping minutes exceeds 3x sessionLength', () => {
      expect(calculateTimeOverlap(500, 90)).toBe(1.0);
    });

    it('scales linearly between 0 and 1.0', () => {
      // 135 / 270 = 0.5
      expect(calculateTimeOverlap(135, 90)).toBe(0.5);
    });

    it('respects custom sessionLengthMinutes', () => {
      // 3 * 60 = 180 min target; 90 min overlap -> 0.5
      expect(calculateTimeOverlap(90, 60)).toBe(0.5);
    });
  });

  describe('calculateRoleComplement', () => {
    it('scores 1.0 for NEEDS_HELP <-> CAN_EXPLAIN in either direction', () => {
      expect(calculateRoleComplement('NEEDS_HELP', 'CAN_EXPLAIN')).toBe(1.0);
      expect(calculateRoleComplement('CAN_EXPLAIN', 'NEEDS_HELP')).toBe(1.0);
    });

    it('scores 0.7 for PEER <-> PEER', () => {
      expect(calculateRoleComplement('PEER', 'PEER')).toBe(0.7);
    });

    it('scores 0.5 for PEER <-> other', () => {
      expect(calculateRoleComplement('PEER', 'NEEDS_HELP')).toBe(0.5);
      expect(calculateRoleComplement('PEER', 'CAN_EXPLAIN')).toBe(0.5);
      expect(calculateRoleComplement('NEEDS_HELP', 'PEER')).toBe(0.5);
      expect(calculateRoleComplement('CAN_EXPLAIN', 'PEER')).toBe(0.5);
    });

    it('scores 0.4 for CAN_EXPLAIN <-> CAN_EXPLAIN', () => {
      expect(calculateRoleComplement('CAN_EXPLAIN', 'CAN_EXPLAIN')).toBe(0.4);
    });

    it('scores 0.3 for NEEDS_HELP <-> NEEDS_HELP', () => {
      expect(calculateRoleComplement('NEEDS_HELP', 'NEEDS_HELP')).toBe(0.3);
    });
  });

  describe('calculateInterests (Jaccard similarity)', () => {
    it('returns 0 when both sets are empty', () => {
      expect(calculateInterests([], [])).toBe(0);
    });

    it('returns 0 when there is zero overlap', () => {
      expect(calculateInterests(['a', 'b'], ['c', 'd'])).toBe(0);
    });

    it('returns 1.0 when sets are identical', () => {
      expect(calculateInterests(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(1.0);
    });

    it('calculates correct Jaccard coefficient for partial overlap', () => {
      // Intersection: {a, b} (size 2)
      // Union: {a, b, c, d} (size 4)
      // Jaccard: 2 / 4 = 0.5
      expect(calculateInterests(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(0.5);
    });
  });

  describe('calculateProximity', () => {
    it('returns 1.0 when either side is ONLINE only', () => {
      expect(calculateProximity(100, 5, true)).toBe(1.0);
      expect(calculateProximity(null, 5, true)).toBe(1.0);
    });

    it('returns 0 when distanceKm is null in person', () => {
      expect(calculateProximity(null, 5, false)).toBe(0);
    });

    it('returns 1.0 when distance is 0 km', () => {
      expect(calculateProximity(0, 5, false)).toBe(1.0);
    });

    it('scales linearly from 1.0 down to 0 at maxDistanceKm', () => {
      // 1 - (2.5 / 5) = 0.5
      expect(calculateProximity(2.5, 5, false)).toBe(0.5);
      expect(calculateProximity(5, 5, false)).toBe(0.0);
    });

    it('clamps to 0 when distance exceeds maxDistanceKm', () => {
      expect(calculateProximity(10, 5, false)).toBe(0.0);
    });
  });

  describe('calculateGroupSizeFit', () => {
    describe('for user candidates (interval overlap)', () => {
      it('returns 1.0 for identical group size preferences', () => {
        expect(calculateGroupSizeFit([2, 4], [2, 4])).toBe(1.0);
      });

      it('returns 0.0 for disjoint ranges', () => {
        expect(calculateGroupSizeFit([2, 3], [4, 6])).toBe(0.0);
      });

      it('calculates ratio for partial overlap', () => {
        // [2, 4] and [3, 5]
        // Overlap: [3, 4] (len 2)
        // Total span: [2, 5] (len 4)
        // Ratio: 2 / 4 = 0.5
        expect(calculateGroupSizeFit([2, 4], [3, 5])).toBe(0.5);
      });
    });

    describe('for group candidates (size inside range)', () => {
      it('returns 1.0 when memberCount + 1 falls within my range', () => {
        // Group has 2 members, candidate joiner makes 3 -> inside [2, 4]
        expect(calculateGroupSizeFit([2, 4], undefined, 2)).toBe(1.0);
      });

      it('returns 0.0 when memberCount + 1 falls outside my range', () => {
        // Group has 4 members, candidate joiner makes 5 -> outside [2, 4]
        expect(calculateGroupSizeFit([2, 4], undefined, 4)).toBe(0.0);
      });
    });
  });

  describe('score() comprehensive', () => {
    it('yields 100.0 for a perfect match', () => {
      const result = score({
        overlappingFreeMinutes: 270,
        sessionLengthMinutes: 90,
        myRole: 'NEEDS_HELP',
        candidateRole: 'CAN_EXPLAIN',
        myInterests: ['exam-prep', 'hackathons'],
        candidateInterests: ['exam-prep', 'hackathons'],
        distanceKm: 0,
        maxDistanceKm: 10,
        isOnline: false,
        myGroupRange: [2, 4],
        candidateGroupRange: [2, 4],
      });

      expect(result.timeOverlap).toBe(1.0);
      expect(result.roleComplement).toBe(1.0);
      expect(result.interests).toBe(1.0);
      expect(result.proximity).toBe(1.0);
      expect(result.groupSizeFit).toBe(1.0);
      expect(result.total).toBe(100.0);
    });

    it('yields 0.0 for a complete mismatch', () => {
      const result = score({
        overlappingFreeMinutes: 0,
        sessionLengthMinutes: 90,
        myRole: 'NEEDS_HELP',
        candidateRole: 'NEEDS_HELP',
        myInterests: ['exam-prep'],
        candidateInterests: ['silent-study'],
        distanceKm: 20,
        maxDistanceKm: 5,
        isOnline: false,
        myGroupRange: [2, 3],
        candidateGroupRange: [5, 6],
      });

      expect(result.timeOverlap).toBe(0.0);
      expect(result.roleComplement).toBe(0.3);
      expect(result.interests).toBe(0.0);
      expect(result.proximity).toBe(0.0);
      expect(result.groupSizeFit).toBe(0.0);
      // Only role complement: 100 * (0.25 * 0.3) = 7.5
      expect(result.total).toBe(7.5);
    });

    it('evaluates group candidates correctly', () => {
      const result = score({
        overlappingFreeMinutes: 135, // 0.5
        sessionLengthMinutes: 90,
        myRole: 'PEER',
        candidateRole: 'PEER', // 0.7
        myInterests: ['exam-prep', 'silent-study'],
        candidateInterests: ['exam-prep'], // 0.5
        distanceKm: 2.5,
        maxDistanceKm: 5, // 0.5
        isOnline: false,
        myGroupRange: [2, 4],
        candidateMemberCount: 2, // 2 + 1 = 3 -> inside [2, 4] -> 1.0
      });

      // 0.35 * 0.5 = 0.175
      // 0.25 * 0.7 = 0.175
      // 0.15 * 0.5 = 0.075
      // 0.15 * 0.5 = 0.075
      // 0.10 * 1.0 = 0.100
      // Sum = 0.600 -> Total = 60.0
      expect(result.total).toBe(60.0);
      expect(result.timeOverlap).toBe(0.5);
      expect(result.roleComplement).toBe(0.7);
      expect(result.interests).toBe(0.5);
      expect(result.proximity).toBe(0.5);
      expect(result.groupSizeFit).toBe(1.0);
    });
  });
});
