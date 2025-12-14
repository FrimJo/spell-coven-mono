import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Serve the repo root as a static site for tests.
// Requires Python to be available (python3 -m http.server 8000).
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  // Global setup to initialize model once for all tests
  globalSetup: resolve(__dirname, './tests/global-setup.ts'),
  use: {
    baseURL: 'https://localhost:1234',
    trace: 'on-first-retry',
    permissions: ['camera'],
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    // Load the storage state from global setup to reuse cached model
    storageState: resolve(__dirname, './.playwright-storage/state.json'),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use Vite dev server for e2e tests
    command: 'bun run dev',
    url: 'https://localhost:1234',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    ignoreHTTPSErrors: true,
  },
})
