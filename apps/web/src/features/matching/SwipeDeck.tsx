import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import type { Schemas } from '@sgm/contracts';
import { Button } from '../../components/form/Button';
import { QueryError } from '../../components/QueryError';
import { Spinner } from '../../components/Spinner';
import { CandidateCard } from './CandidateCard';
import { useCandidates, useSwipe, type CandidateKind } from './queries';
import { SwipeCard, type ExitDirection } from './SwipeCard';

type Direction = Schemas['SwipeRequest']['direction'];

interface SwipeDeckProps {
  subjectId: string;
  kind: CandidateKind;
  onMatch: (match: Schemas['Match'], candidate: Schemas['Candidate']) => void;
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** The deck: top card + Like / Pass (buttons or ← / → keys). Fetches more when it runs low. */
export function SwipeDeck({ subjectId, kind, onMatch }: SwipeDeckProps) {
  const candidates = useCandidates(subjectId, kind);
  const swipe = useSwipe();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [exitDirection, setExitDirection] = useState<ExitDirection>(1);

  const queue = (candidates.data ?? []).filter((c) => !gone.has(c.id));
  const top = queue[0];

  const decide = useCallback(
    (direction: Direction) => {
      if (!top) return;
      setExitDirection(direction === 'LIKE' ? 1 : -1); // the card flies the way it was swiped
      setGone((prev) => new Set(prev).add(top.id));
      swipe.mutate(
        { targetKind: top.kind, targetId: top.id, subjectId, direction },
        {
          onSuccess: (result) => {
            if (result.match) onMatch(result.match, top);
            if (queue.length <= 2) void candidates.refetch(); // swiped ones are excluded server-side
          },
        },
      );
    },
    [top, queue.length, subjectId, swipe, onMatch, candidates],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowLeft') decide('PASS');
      if (e.key === 'ArrowRight') decide('LIKE');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide]);

  if (candidates.isPending) return <Spinner label="Finding study partners" />;
  if (candidates.isError && !top) return <QueryError what="study partners" error={candidates.error} onRetry={() => void candidates.refetch()} />;

  if (!top) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <p className="font-medium">{candidates.isFetching ? 'Looking for more…' : "You've seen everyone for now."}</p>
        <p className="text-sm text-slate-600">
          {kind === 'user' ? 'Try open groups for this subject, another subject, or check back later.' : 'No open groups with space right now. Try people instead.'}
        </p>
        <Button variant="secondary" onClick={() => void candidates.refetch()} loading={candidates.isFetching}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MotionConfig reducedMotion="user">
        <div className="relative">
          {queue[1] && <div className="absolute inset-x-3 -bottom-2 h-full rounded-2xl border border-slate-200 bg-white/70" aria-hidden />}
          <div className="relative" aria-live="polite">
            <AnimatePresence initial={false} custom={exitDirection}>
              <SwipeCard key={top.id} onSwipe={decide}>
                <CandidateCard candidate={top} />
              </SwipeCard>
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => decide('PASS')}
          aria-label="Pass"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 bg-white text-2xl text-slate-500 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => decide('LIKE')}
          aria-label="Like"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-3xl text-white shadow-md hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          ♥
        </button>
      </div>
      <p className="text-center text-xs text-slate-500">
        Drag the card, or use <kbd className="rounded border px-1">←</kbd> to pass and <kbd className="rounded border px-1">→</kbd> to like.
      </p>
    </div>
  );
}
