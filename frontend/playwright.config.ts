import { defineConfig, devices } from '@playwright/test'

// E2E per lo Studio immagine (e altri flussi). I browser vanno installati una volta: `npx playwright install`.
// Auth: `auth.setup.ts` fa login con PLAYWRIGHT_EMAIL/PLAYWRIGHT_PASSWORD e salva lo storageState,
// così gli spec partono già autenticati (lo Studio è dietro RequireAuth).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, testIgnore: /.*-mobile\.spec\.ts/ },
    {
      name: 'chromium',
      testIgnore: /.*-mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    // Pagine PUBBLICHE su telefono (es. la lista d'attesa Maestranze, che arriva da
    // Instagram): niente login e niente storageState — vanno viste come le vede uno
    // che non ha un account, su un telefono vero.
    {
      name: 'mobile-noauth',
      testMatch: /.*-mobile\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
    // Pagine pubbliche desktop senza login (es. grounding visivo della landing a più viewport).
    {
      name: 'desktop-noauth',
      testMatch: /.*-visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Avvia il dev server se non gira già (salta se PLAYWRIGHT_BASE_URL punta a prod/anteprima).
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
