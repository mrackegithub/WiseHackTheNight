import { defineConfig, devices } from '@playwright/test';

const PORT = 5174; // own server so a dev server on 5173 (maybe with mocks off) doesn't interfere

/**
 * End-to-end tests against the MSW mocks (no backend needed). For Phase 2 run them against the
 * real API with E2E_USE_MOCKS=false and the API running (see docs/stack/frontend.md).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_USE_MOCKS: process.env.E2E_USE_MOCKS ?? 'true' },
  },
});
