import { describe, expect, it } from 'vitest';
import { swipeDecision } from './swipe-decision';

describe('swipeDecision', () => {
  it('likes on a long drag or a fast fling to the right', () => {
    expect(swipeDecision(150, 0)).toBe('LIKE');
    expect(swipeDecision(30, 900)).toBe('LIKE');
  });

  it('passes on a long drag or a fast fling to the left', () => {
    expect(swipeDecision(-150, 0)).toBe('PASS');
    expect(swipeDecision(-20, -900)).toBe('PASS');
  });

  it('snaps back for small, slow drags', () => {
    expect(swipeDecision(60, 200)).toBeNull();
    expect(swipeDecision(-60, -200)).toBeNull();
  });
});
