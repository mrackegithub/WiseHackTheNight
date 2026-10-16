import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/Spinner';
import { useAuth } from './auth-context';

/** Route guard: unauthenticated users go to /login and come back afterwards. */
export function RequireAuth() {
  const { isAuthenticated, isLoadingMe } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (isLoadingMe) return <Spinner label="Loading your profile" />;
  return <Outlet />;
}
