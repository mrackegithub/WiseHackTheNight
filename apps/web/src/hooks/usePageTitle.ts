import { useEffect } from 'react';

const APP = 'Study Group Matcher';

/** Sets the browser tab title, e.g. "Calendar · Study Group Matcher" (screen readers announce it on navigation). */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
  }, [title]);
}
