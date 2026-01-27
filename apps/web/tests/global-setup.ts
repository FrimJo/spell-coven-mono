import { existsSync, mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import type { FullConfig } from '@playwright/test'
import { chromium } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) env[key] = valueParts.join('=')
      }
    }
    return env
  } catch {
    return {}
  }
}

const testEnv = loadEnvFile(resolve(__dirname, '../.env.test.local'))

const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const STORAGE_STATE_PATH = resolve(STORAGE_DIR, 'state.json')

async function globalSetup(config: FullConfig) {
  const email = testEnv.DISCORD_TEST_EMAIL
  const password = testEnv.DISCORD_TEST_PASSWORD

  if (!email || !password) {
    console.log('⚠️ Discord test credentials not found, skipping auth setup')
    return
  }

  console.log('🚀 Starting global setup - authenticating with Discord...')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    permissions: ['camera'],
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    const baseURL = config.projects[0]?.use.baseURL || 'https://localhost:1234'
    const baseOrigin = new URL(baseURL).origin

    await page.goto(baseURL)
    await page.waitForLoadState('networkidle')

    const signInButton = page
      .getByRole('navigation')
      .getByRole('button', { name: /Sign in with Discord/i })
    await signInButton.click()

    await page.waitForURL(/discord\.com/)

    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', password)
    await page.click('button[type="submit"]')

    const authorizeButton = page.getByRole('button', { name: /Authorize/i })
    if (await authorizeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await authorizeButton.click()
    }

    try {
      await page.waitForURL((url) => url.origin === baseOrigin, {
        timeout: 60_000,
      })
      await page.waitForLoadState('domcontentloaded')
      console.log('✅ Discord authentication complete')
    } catch {
      console.warn(
        '⚠️ Discord auth redirect timed out, continuing without auth',
      )
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    }

    await page.evaluate((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          videoEnabled: false,
          audioEnabled: false,
          videoinput: 'mock-camera-1',
          audioinput: 'mock-mic-1',
        }),
      )
    }, 'mtg-selected-media-devices')

    console.log('✅ Media preferences configured')

    if (!existsSync(STORAGE_DIR)) {
      mkdirSync(STORAGE_DIR, { recursive: true })
    }

    await context.storageState({ path: STORAGE_STATE_PATH })
    console.log(`💾 Browser state saved to ${STORAGE_STATE_PATH}`)
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }

  console.log('🎉 Global setup completed!')
}

export default globalSetup
