import type { ReactNode } from 'react';
import { motion, useIsPresent, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { swipeDecision, type SwipeDirection } from './swipe-decision';

/** Exit direction: +1 flies right (like), -1 flies left (pass). Passed via AnimatePresence `custom`. */
export type ExitDirection = 1 | -1;

const variants = {
  enter: { scale: 0.96, opacity: 0, y: 8 },
  center: { scale: 1, opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: (dir: ExitDirection) => ({ x: dir * 520, rotate: dir * 22, opacity: 0, transition: { duration: 0.28, ease: 'easeIn' as const } }),
};

/** Draggable wrapper for the top card: tilts with the drag, shows LIKE / PASS stamps, swipes past a threshold. */
export function SwipeCard({ onSwipe, children }: { onSwipe: (d: SwipeDirection) => void; children: ReactNode }) {
  const isPresent = useIsPresent();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-14, 14]);
  const likeOpacity = useTransform(x, [30, 110], [0, 1]);
  const passOpacity = useTransform(x, [-110, -30], [1, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const decision = swipeDecision(info.offset.x, info.velocity.x);
    if (decision) onSwipe(decision);
  }

  return (
    <motion.div
      // the leaving card is only decoration while it flies out
      aria-hidden={!isPresent || undefined}
      className={`relative touch-pan-y select-none ${isPresent ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none absolute inset-0'}`}
      style={{ x, rotate }}
      drag={isPresent ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      <motion.span
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-5 top-5 z-10 -rotate-12 rounded-md border-4 border-emerald-500 px-2 text-2xl font-black tracking-wider text-emerald-600"
      >
        LIKE
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute right-5 top-5 z-10 rotate-12 rounded-md border-4 border-rose-500 px-2 text-2xl font-black tracking-wider text-rose-600"
      >
        PASS
      </motion.span>
      {children}
    </motion.div>
  );
}
