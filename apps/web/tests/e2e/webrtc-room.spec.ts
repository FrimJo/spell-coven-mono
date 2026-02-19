import { test } from '@playwright/test'

import type { RoomHarness } from '../helpers/room-harness'
import { hasAuthCredentials } from '../helpers/auth-storage'
import {
  assertAllPlayersMediaHealthy,
  setupStableRoom,
} from '../helpers/room-harness'

test.describe('WebRTC 4-player room', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires object destructuring
  test('players join and render remote video/audio', async ({}, testInfo) => {
    test.setTimeout(360_000)

    if (!hasAuthCredentials()) {
      test.skip(
        true,
        'E2E auth env vars missing. Set VITE_CONVEX_URL and PREVIEW_LOGIN_CODE.',
      )
    }

    const baseURL = testInfo.project.use.baseURL as string | undefined
    if (!baseURL) {
      throw new Error('Playwright baseURL is not configured.')
    }

    let harness: RoomHarness | undefined
    try {
      harness = await setupStableRoom({ baseURL, testInfo })
      await assertAllPlayersMediaHealthy(harness, testInfo)
    } finally {
      await harness?.teardown()
    }
  })
})
