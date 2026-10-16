import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '../api/tokens';
import { toast } from '../lib/toast';
import { resetDb } from '../mocks/db';
import { server } from '../mocks/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  localStorage.clear();
  tokenStore.reload();
  toast.clear();
});
afterAll(() => server.close());
