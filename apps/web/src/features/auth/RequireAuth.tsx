import { Navigate, Outlet, useLocation } from 'react-router';
import { Button } from '../../components/form/Button';
import { QueryError } from '../../components/QueryError';
import { Spinner } from '../../components/Spinner';
import { useAuth } from './auth-context';

/** Route guard: unauthenticated users go to /login and come back afterwards. */
export function RequireAuth() {
  const { isAuthenticated, isLoadingMe, meError, retryMe, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (isLoadingMe) return <Spinner label="Loading your profile" />;
  if (meError) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 py-12">
        <QueryError what="your profile" error={meError} onRetry={retryMe} />
        <Button variant="ghost" onClick={logout}>
          Log out
        </Button>
      </div>
    );
  }
  return <Outlet />;
}
