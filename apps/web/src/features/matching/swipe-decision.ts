export type SwipeDirection = 'LIKE' | 'PASS';

/** Drag distance (px) or fling speed (px/s) that counts as a swipe. */
export const SWIPE_DISTANCE = 110;
export const SWIPE_VELOCITY = 650;

/** What a released drag means: like (right), pass (left), or nothing (card snaps back). */
export function swipeDecision(offsetX: number, velocityX: number): SwipeDirection | null {
  if (offsetX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY) return 'LIKE';
  if (offsetX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY) return 'PASS';
  return null;
}
