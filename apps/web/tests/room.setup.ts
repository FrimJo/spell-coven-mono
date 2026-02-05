/**
 * Playwright Room Setup
 *
 * Creates a game room through the UI and stores the room ID for tests.
 *
 * Depends on auth.setup.ts (storage state with auth tokens).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { expect, test as setup } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const AUTH_STATE_PATH = resolve(STORAGE_DIR, 'state.json')
const ROOM_STATE_PATH = resolve(STORAGE_DIR, 'room.json')

setup('create a game room via the landing page', async ({ page }) => {
  if (!existsSync(AUTH_STATE_PATH)) {
    throw new Error(
      `Auth storage state not found at ${AUTH_STATE_PATH}. Run auth.setup.ts or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD and VITE_CONVEX_URL.`,
    )
  }

  const forceNewRoom = process.env.E2E_FORCE_NEW_ROOM === 'true'
  if (!forceNewRoom && existsSync(ROOM_STATE_PATH)) {
    try {
      const cached = JSON.parse(readFileSync(ROOM_STATE_PATH, 'utf-8')) as {
        roomId?: string
      }
      if (cached.roomId) {
        return
      }
    } catch {
      // Fall through to create a fresh room if cache is malformed.
    }
  }

  await page.goto('/')

  const createButton = page.getByTestId('create-game-button')
  await expect(createButton).toBeVisible({ timeout: 10000 })
  await createButton.click()

  await expect(page.getByText('Game room created successfully!')).toBeVisible({
    timeout: 20000,
  })

  const shareLinkLocator = page.getByText(/\/game\/[A-Z0-9]{6}/)
  const shareLinkText = (await shareLinkLocator.first().textContent()) ?? ''
  const match = shareLinkText.match(/\/game\/([A-Z0-9]{6})/)

  if (!match) {
    throw new Error(
      `Room setup failed to capture game ID from: "${shareLinkText}"`,
    )
  }

  const roomId = match[1]

  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true })
  }

  writeFileSync(
    ROOM_STATE_PATH,
    JSON.stringify({ roomId, createdAt: Date.now() }, null, 2),
  )
})
