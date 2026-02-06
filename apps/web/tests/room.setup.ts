/**
 * Playwright Room Setup
 *
 * Creates a game room through the UI and stores the room ID for tests.
 *
 * Uses per-worker auth storage state to authenticate.
 */

import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test as setup } from '@playwright/test'

import {
  ensureWorkerStorageState,
  hasAuthCredentials,
} from './helpers/auth-storage'
import {
  createRoomViaUI,
  readCachedRoomId,
  writeRoomState,
} from './helpers/test-utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

setup(
  'create a game room via the landing page',
  async ({ browser, baseURL }) => {
    if (!hasAuthCredentials()) {
      throw new Error(
        'Auth env vars missing. Set E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, and VITE_CONVEX_URL.',
      )
    }
    if (!baseURL) {
      throw new Error('Playwright baseURL is not configured.')
    }

    const cached = readCachedRoomId()
    if (cached) {
      return
    }

    const storageStatePath = await ensureWorkerStorageState(0, baseURL)
    const context = await browser.newContext({
      storageState: storageStatePath,
      baseURL,
    })
    const page = await context.newPage()
    const roomId = await createRoomViaUI(page)
    await context.close()
    writeRoomState(roomId)
  },
)
