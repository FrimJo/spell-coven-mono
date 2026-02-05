/**
 * Playwright Room Setup
 *
 * Creates a game room through the UI and stores the room ID for tests.
 *
 * Depends on auth.setup.ts (storage state with auth tokens).
 */

import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test as setup } from '@playwright/test'

import {
  createRoomViaUI,
  readCachedRoomId,
  writeRoomState,
} from './helpers/test-utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const STORAGE_DIR = resolve(__dirname, '../.playwright-storage')
const AUTH_STATE_PATH = resolve(STORAGE_DIR, 'state.json')

setup('create a game room via the landing page', async ({ page }) => {
  if (!existsSync(AUTH_STATE_PATH)) {
    throw new Error(
      `Auth storage state not found at ${AUTH_STATE_PATH}. Run auth.setup.ts or set E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD and VITE_CONVEX_URL.`,
    )
  }

  const cached = readCachedRoomId()
  if (cached) {
    return
  }

  const roomId = await createRoomViaUI(page)
  writeRoomState(roomId)
})
