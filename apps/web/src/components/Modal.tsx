import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional description id content, read by screen readers after the title. */
  description?: ReactNode;
  size?: 'sm' | 'md';
}

/**
 * Accessible dialog: labelled, Escape and backdrop close it, focus moves inside on open
 * (to [data-autofocus] if present) and is kept inside with Tab, then returns on close.
 */
export function Modal({ title, onClose, children, description, size = 'sm' }: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the effect (callers often pass inline functions; re-running would
  // steal focus back to the first field on every parent render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = panel.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus();
    // The page behind must not scroll while the dialog is open (the dialog itself may scroll).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && el) {
        const focusables = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl outline-none ${size === 'md' ? 'max-w-lg' : 'max-w-sm'}`}
      >
        <h2 id={titleId} className="text-center text-2xl font-bold">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-center text-sm text-slate-600">
            {description}
          </div>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
