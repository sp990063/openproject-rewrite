// playwright.config.js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'frontend/test/e2e',
  fullyParallel: false,  // one suite for now
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
