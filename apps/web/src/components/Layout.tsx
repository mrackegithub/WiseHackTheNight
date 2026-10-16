import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../features/auth/auth-context';

const icon = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  discover: 'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm5 10.5 3.5-3.4a2 2 0 0 0-3-2.6l-.5.5-.5-.5a2 2 0 0 0-3 2.6z',
  groups: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7 0a2.5 2.5 0 1 0 0-5M3 20a6 6 0 0 1 12 0zm13.5 0H21a5 5 0 0 0-6-4.9',
  calendar: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
};

const navItems = [
  { to: '/', label: 'Home', icon: icon.home },
  { to: '/discover', label: 'Discover', icon: icon.discover },
  { to: '/groups', label: 'Groups', icon: icon.groups },
  { to: '/calendar', label: 'Calendar', icon: icon.calendar },
];

/** Moves focus to <main> after client-side navigation, so screen readers start at the new page. */
function useFocusMainOnNavigate() {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.focus({ preventScroll: false });
  }, [pathname]);
  return main;
}

export function Layout() {
  const { isAuthenticated, me, logout } = useAuth();
  const main = useFocusMainOnNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-indigo-700 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-bold tracking-tight text-indigo-700">
            Study Group Matcher
          </Link>
          {isAuthenticated && (
            // One nav for all sizes: a fixed bottom tab bar on phones, inline in the header from `sm` up.
            <nav
              aria-label="Main"
              className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:flex sm:gap-1 sm:border-0 sm:bg-transparent sm:pb-0"
            >
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] sm:flex-row sm:rounded-md sm:px-3 sm:py-1.5 sm:text-sm ${
                      isActive ? 'text-indigo-700 sm:bg-indigo-50' : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 sm:hidden" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                    <path d={item.icon} />
                  </svg>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm">
            {isAuthenticated ? (
              <>
                {me && <span className="hidden text-slate-600 sm:inline">{me.displayName}</span>}
                <button type="button" onClick={logout} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main
        id="main"
        ref={main}
        tabIndex={-1}
        className={`mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none ${isAuthenticated ? 'pb-24 sm:pb-6' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
}
