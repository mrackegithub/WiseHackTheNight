import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet } from 'react-router';
import { meQuery } from '../auth/auth-context';

/** Signed-in users who haven't finished onboarding are sent to the wizard first. */
export function RequireOnboarding() {
  // Read the query cache directly (not the auth context) so a /me refetched right before
  // navigating here is already visible on this render.
  const { data: me } = useQuery({ ...meQuery, enabled: false });
  if (me && !me.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
