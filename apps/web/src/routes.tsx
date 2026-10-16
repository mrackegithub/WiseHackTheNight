import type { RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import { RequireAuth } from './features/auth/RequireAuth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [{ index: true, element: <HomePage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
