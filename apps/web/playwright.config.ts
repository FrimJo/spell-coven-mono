import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'https://localhost:1234',
    trace: 'on-first-retry',
    permissions: ['camera'],
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera'],
        storageState: resolve(__dirname, './.playwright-storage/state.json'),
      },
      dependencies: ['setup'],
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
