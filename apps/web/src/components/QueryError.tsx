import { messageForError } from '../lib/error-messages';
import { Button } from './form/Button';

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
  /** What failed to load, e.g. "your groups". */
  what?: string;
  compact?: boolean;
}

/** Inline "couldn't load" state with a retry button. Used instead of a toast for a page's main data. */
export function QueryError({ error, onRetry, what = 'this', compact = false }: QueryErrorProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 text-center text-sm text-red-800 ${compact ? 'px-3 py-3' : 'px-6 py-8'}`}
    >
      <p className="font-medium">Couldn't load {what}.</p>
      <p className="text-red-700">{messageForError(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
