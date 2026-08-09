import { defineConfig, devices } from '@playwright/test'

/** Production preview + service worker for offline evidence. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /offline\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [{ name: 'chromium-offline', use: { ...devices['Desktop Chrome'] } }],
})
