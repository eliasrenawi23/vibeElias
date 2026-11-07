import { defineConfig, devices } from '@playwright/test';

/** Dev server port; `PW_PORT=5174 npx playwright test` runs next to a dev server already on 5173. */
const PORT = Number(process.env.PW_PORT ?? 5173);
const baseURL = `http://localhost:${PORT}`;

/**
 * UI smoke tests. They run against the Vite dev server with every `/api/**` call mocked in the
 * spec (`page.route`), so the backend does not need to be running.
 */
// Default export required by Playwright.
export default defineConfig({
  testDir: './e2e',
  // Flows cross several pages and dialogs against the dev server.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
