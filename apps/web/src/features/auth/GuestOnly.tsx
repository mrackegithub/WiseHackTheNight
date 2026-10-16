import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

/** Login/register are for signed-out users only; signed-in users go where they were headed. */
export function GuestOnly() {
  const { isAuthenticated } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  return isAuthenticated ? <Navigate to={from} replace /> : <Outlet />;
}
