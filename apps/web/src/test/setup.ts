import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '../api/tokens';
import { toast } from '../lib/toast';
import { resetDb } from '../mocks/db';
import { server } from '../mocks/server';

// Swipe animations would leave exiting cards in the DOM between assertions.
MotionGlobalConfig.skipAnimations = true;

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
