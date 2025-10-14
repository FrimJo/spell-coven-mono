import { defineConfig, devices } from '@playwright/test'

// Serve the repo root as a static site for tests.
// Requires Python to be available (python3 -m http.server 8000).
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    permissions: ['camera'],
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use Vite preview to serve the SPA on port 3000
    command: 'pnpm serve',
    url: 'http://localhost:3000',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
