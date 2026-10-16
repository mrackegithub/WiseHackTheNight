import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { GuestOnly } from './features/auth/GuestOnly';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireOnboarding } from './features/onboarding/RequireOnboarding';
import { CalendarPage } from './pages/CalendarPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { GroupPage } from './pages/GroupPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RegisterPage } from './pages/RegisterPage';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { element: <GuestOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
      { element: <GuestOnly redirectTo="/onboarding" />, children: [{ path: '/register', element: <RegisterPage /> }] },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          // Everything else needs a finished profile.
          {
            element: <RequireOnboarding />,
            children: [
              { index: true, element: <HomePage /> },
              { path: '/discover', element: <DiscoverPage /> },
              { path: '/calendar', element: <CalendarPage /> },
              { path: '/groups/:groupId', element: <GroupPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
