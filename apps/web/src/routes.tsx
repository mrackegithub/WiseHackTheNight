import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { Spinner } from './components/Spinner';
import { GuestOnly } from './features/auth/GuestOnly';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireOnboarding } from './features/onboarding/RequireOnboarding';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

/*
 * Small, first-visit pages are bundled eagerly; the heavy ones (framer-motion, luxon, Leaflet, the
 * onboarding wizard) are split per route so the first load only ships the shell.
 */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    hydrateFallbackElement: <Spinner label="Loading" />,
    children: [
      { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
      { element: <GuestOnly redirectTo="/onboarding" />, children: [{ path: '/register', element: <RegisterPage /> }] },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', lazy: () => import('./pages/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })) },
          // Everything else needs a finished profile.
          {
            element: <RequireOnboarding />,
            children: [
              { index: true, element: <HomePage /> },
              { path: '/discover', lazy: () => import('./pages/DiscoverPage').then((m) => ({ Component: m.DiscoverPage })) },
              { path: '/calendar', lazy: () => import('./pages/CalendarPage').then((m) => ({ Component: m.CalendarPage })) },
              { path: '/groups', lazy: () => import('./pages/GroupsPage').then((m) => ({ Component: m.GroupsPage })) },
              { path: '/groups/:groupId', lazy: () => import('./pages/GroupPage').then((m) => ({ Component: m.GroupPage })) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
