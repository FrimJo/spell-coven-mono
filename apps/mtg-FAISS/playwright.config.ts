import { defineConfig, devices } from '@playwright/test';

// Serve the repo root as a static site for tests.
// Requires Python to be available (python3 -m http.server 8000).
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8000',
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
    command: 'python3 -m http.server 8000',
    url: 'http://localhost:8000',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
