import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.APP_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  // Stress test "realistic_scenario" girato esplicitamente via `npm run scenario`.
  // E` sensibile al wall-clock limit degli isolate Edge in locale: stabile da solo,
  // flaky se concatenato con tutta la suite.
  testIgnore: process.env.RUN_STRESS ? [] : ['**/realistic_scenario.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm --prefix frontend run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
