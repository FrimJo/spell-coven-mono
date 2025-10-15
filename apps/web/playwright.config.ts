import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Serve the repo root as a static site for tests.
// Requires Python to be available (python3 -m http.server 8000).
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: 0,
  // Global setup to initialize model once for all tests
  globalSetup: resolve(__dirname, './tests/global-setup.ts'),
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    permissions: ['camera'],
    video: 'retain-on-failure',
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
    // Use Vite preview to serve the SPA on port 3000
    command: 'pnpm serve',
    url: 'http://localhost:3000',
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
