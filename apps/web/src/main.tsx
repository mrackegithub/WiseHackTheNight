import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './AppProviders';
import { config } from './lib/config';
import { createQueryClient } from './lib/query-client';
import { routes } from './routes';
import './index.css';

async function enableMocks() {
  // import.meta.env.DEV is inlined by Vite, so production builds drop the mocks entirely.
  if (!import.meta.env.DEV || !config.useMocks) return;
  const { worker } = await import('./mocks/browser');
  // The msw() Vite plugin serves the worker script at this URL during dev.
  await worker.start({ serviceWorker: { url: '/mockServiceWorker.js' }, onUnhandledFrame: 'bypass', quiet: true });
}

const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

await enableMocks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
