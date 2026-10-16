import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

/**
 * Login/register are for signed-out users only. This is also the single place that redirects after
 * a successful login/register: to the page that sent the user to /login, else to `redirectTo`.
 * (Pages just call `login()`; navigating from both places races.)
 */
export function GuestOnly({ redirectTo = '/' }: { redirectTo?: string }) {
  const { isAuthenticated } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  return isAuthenticated ? <Navigate to={from ?? redirectTo} replace /> : <Outlet />;
}
