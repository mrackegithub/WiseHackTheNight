import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../features/auth/auth-context';

const navItems = [{ to: '/', label: 'Home' }];

export function Layout() {
  const { isAuthenticated, me, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-bold tracking-tight text-indigo-700">
            Study Group Matcher
          </Link>
          {isAuthenticated && (
            <nav className="flex gap-1" aria-label="Main">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`
                  }
                >
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
