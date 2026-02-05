import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts', '**/*.setup.ts'],
  timeout: 60_000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ['github'],
        ['junit', { outputFile: 'results.xml' }],
        ['html', { open: 'never' }],
      ]
    : [['list']],
  use: {
    baseURL: 'https://localhost:1234',
    trace: 'on-first-retry',
    permissions: ['camera', 'microphone'],
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'room-setup',
      testMatch: '**/room.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera'],
        storageState: resolve(__dirname, './.playwright-storage/state.json'),
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'chromium',
      testMatch: ['e2e/**/*.spec.ts', 'visual/**/*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone', 'camera'],
        storageState: resolve(__dirname, './.playwright-storage/state.json'),
      },
      dependencies: ['room-setup'],
    },
  ],
  webServer: [
    {
      command: 'bun run convex:test',
      cwd: resolve(__dirname, '../..'),
      url: 'http://127.0.0.1:3210',
      timeout: process.env.CI ? 120_000 : 90_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      ignoreHTTPSErrors: true,
    },
    {
      command: 'bun run dev:test',
      url: 'https://localhost:1234',
      timeout: process.env.CI ? 120_000 : 90_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      ignoreHTTPSErrors: true,
    },
  ],
})
