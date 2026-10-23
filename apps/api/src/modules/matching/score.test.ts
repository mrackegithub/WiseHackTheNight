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
    it('returns 0 when there are no overlapping minutes or I have no free time', () => {
      expect(calculateTimeOverlap(0, 600)).toBe(0);
      expect(calculateTimeOverlap(-10, 600)).toBe(0);
      expect(calculateTimeOverlap(120, 0)).toBe(0);
    });

    it('returns 1.0 when they are free whenever I am', () => {
      expect(calculateTimeOverlap(600, 600)).toBe(1.0);
    });

    it('rewards both proportional availability and absolute study cadence', () => {
      const scoreHalf = calculateTimeOverlap(300, 600);
      expect(scoreHalf).toBeGreaterThan(0.5);
      expect(scoreHalf).toBeLessThan(1.0);
    });

    it('caps at 1.0', () => {
      expect(calculateTimeOverlap(700, 600)).toBe(1.0);
    });
  });

  describe('calculateRoleComplement', () => {
    it('scores 1.0 for NEEDS_HELP <-> CAN_EXPLAIN in either direction', () => {
      expect(calculateRoleComplement('NEEDS_HELP', 'CAN_EXPLAIN')).toBe(1.0);
      expect(calculateRoleComplement('CAN_EXPLAIN', 'NEEDS_HELP')).toBe(1.0);
    });

    it('scores 0.85 for PEER <-> PEER collaboration', () => {
      expect(calculateRoleComplement('PEER', 'PEER')).toBe(0.85);
    });

    it('scores 0.80 for PEER <-> CAN_EXPLAIN', () => {
      expect(calculateRoleComplement('PEER', 'CAN_EXPLAIN')).toBe(0.80);
      expect(calculateRoleComplement('CAN_EXPLAIN', 'PEER')).toBe(0.80);
    });

    it('scores 0.70 for PEER <-> NEEDS_HELP', () => {
      expect(calculateRoleComplement('PEER', 'NEEDS_HELP')).toBe(0.70);
      expect(calculateRoleComplement('NEEDS_HELP', 'PEER')).toBe(0.70);
    });

    it('scores 0.65 for CAN_EXPLAIN <-> CAN_EXPLAIN', () => {
      expect(calculateRoleComplement('CAN_EXPLAIN', 'CAN_EXPLAIN')).toBe(0.65);
    });

    it('scores 0.45 for NEEDS_HELP <-> NEEDS_HELP', () => {
      expect(calculateRoleComplement('NEEDS_HELP', 'NEEDS_HELP')).toBe(0.45);
    });
  });

  describe('calculateInterests (Jaccard + Overlap)', () => {
    it('returns 0 when both sets are empty', () => {
      expect(calculateInterests([], [])).toBe(0);
    });

    it('returns 0 when there is zero overlap', () => {
      expect(calculateInterests(['a', 'b'], ['c', 'd'])).toBe(0);
    });

    it('returns 1.0 when sets are identical', () => {
      expect(calculateInterests(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(1.0);
    });

    it('rewards subset overlap higher than pure Jaccard', () => {
      // Intersection: {a, b} (size 2), Union: {a, b, c, d} (size 4), Jaccard: 0.5, Overlap: 2/3 ≈ 0.667
      const res = calculateInterests(['a', 'b', 'c'], ['a', 'b', 'd']);
      expect(res).toBeGreaterThan(0.5);
    });
  });

  describe('calculateProximity', () => {
    it('returns 1.0 for purely online users without physical distance', () => {
      expect(calculateProximity(null, 5, true)).toBe(1.0);
    });

    it('returns 0 when distanceKm is null in person', () => {
      expect(calculateProximity(null, 5, false)).toBe(0);
    });

    it('returns 1.0 when distance is 0 km', () => {
      expect(calculateProximity(0, 5, false)).toBe(1.0);
    });

    it('gives near-perfect scores for immediate neighborhood (< 1km)', () => {
      expect(calculateProximity(0.5, 5, false)).toBeGreaterThan(0.95);
    });

    it('decays smoothly with distance and does not inflate distant candidates', () => {
      const near = calculateProximity(0.5, 7.5, false);
      const far = calculateProximity(5.5, 7.5, false);
      expect(near).toBeGreaterThan(0.95);
      expect(far).toBeLessThan(0.50);
      expect(near).toBeGreaterThan(far);
    });

    it('clamps to 0 when distance reaches or exceeds maxDistanceKm', () => {
      expect(calculateProximity(5, 5, false)).toBe(0.0);
      expect(calculateProximity(10, 5, false)).toBe(0.0);
    });
  });

  describe('calculateGroupSizeFit', () => {
    describe('for user candidates (interval overlap)', () => {
      it('returns 1.0 for identical group size preferences', () => {
        expect(calculateGroupSizeFit([2, 4], [2, 4])).toBe(1.0);
      });

      it('returns soft score for adjacent ranges and 0 for distant ranges', () => {
        expect(calculateGroupSizeFit([2, 3], [4, 5])).toBe(0.4);
        expect(calculateGroupSizeFit([2, 2], [6, 8])).toBe(0.0);
      });

      it('calculates score for partial overlap', () => {
        expect(calculateGroupSizeFit([2, 4], [3, 5])).toBeGreaterThan(0.7);
      });
    });

    describe('for group candidates (size inside range)', () => {
      it('returns 1.0 when memberCount + 1 falls within my range', () => {
        expect(calculateGroupSizeFit([2, 4], undefined, 2)).toBe(1.0);
      });

      it('returns soft decay when just 1 member outside range', () => {
        expect(calculateGroupSizeFit([2, 4], undefined, 4)).toBe(0.6);
      });
    });
  });

  describe('score() comprehensive', () => {
    it('yields 100.0 for a perfect match', () => {
      const result = score({
        overlappingFreeMinutes: 270,
        myFreeMinutes: 270,
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

    it('evaluates mismatched candidates appropriately', () => {
      const result = score({
        overlappingFreeMinutes: 0,
        myFreeMinutes: 270,
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
      expect(result.roleComplement).toBe(0.45);
      expect(result.interests).toBe(0.0);
      expect(result.proximity).toBe(0.0);
      expect(result.groupSizeFit).toBe(0.0);
      expect(result.total).toBe(11.3);
    });

    it('evaluates group candidates correctly', () => {
      const result = score({
        overlappingFreeMinutes: 135,
        myFreeMinutes: 270,
        myRole: 'PEER',
        candidateRole: 'PEER',
        myInterests: ['exam-prep', 'silent-study'],
        candidateInterests: ['exam-prep'],
        distanceKm: 2.5,
        maxDistanceKm: 5,
        isOnline: false,
        myGroupRange: [2, 4],
        candidateMemberCount: 2,
      });

      expect(result.total).toBeGreaterThan(60.0);
      expect(result.roleComplement).toBe(0.85);
      expect(result.groupSizeFit).toBe(1.0);
    });
  });
});
