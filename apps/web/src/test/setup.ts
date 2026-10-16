import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { tokenStore } from '../api/tokens';
import { toast } from '../lib/toast';
import { resetDb } from '../mocks/db';
import { server } from '../mocks/server';

// Pages are lazy routes: the first findBy* in a file waits for a cold module import, which can
// exceed the 1 s default on slower machines/CI.
configure({ asyncUtilTimeout: 3000 });

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
