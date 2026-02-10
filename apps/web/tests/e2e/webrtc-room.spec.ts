import { expect, test } from '@playwright/test'

import {
  ensureWorkerStorageState,
  hasAuthCredentials,
} from '../helpers/auth-storage'
import { launchPlayer } from '../helpers/launch-player'
import {
  expectAudioEnergy,
  expectVideoRendering,
} from '../helpers/media-assertions'
import { getRoomId, navigateToTestGame } from '../helpers/test-utils'

test.describe('WebRTC 4-player room', () => {
  test('players join and render remote video/audio', async ({}, testInfo) => {
    test.setTimeout(180_000)

    if (!hasAuthCredentials()) {
      test.skip(
        true,
        'E2E auth env vars missing. Set VITE_CONVEX_URL and either PREVIEW_LOGIN_CODE or E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD.',
      )
    }

    const baseURL = testInfo.project.use.baseURL as string | undefined
    if (!baseURL) {
      throw new Error('Playwright baseURL is not configured.')
    }

    const roomId = getRoomId()

    const storageStatePaths = await Promise.all(
      [0, 1, 2, 3].map((index) => ensureWorkerStorageState(index, baseURL)),
    )

    const players = await Promise.all(
      storageStatePaths.map((storageStatePath, index) =>
        launchPlayer({
          baseURL,
          storageStatePath,
          toneHz: 440 + index * 110,
          label: `Player ${index + 1}`,
        }),
      ),
    )

    try {
      await Promise.all(
        players.map((player) =>
          navigateToTestGame(player.page, roomId, {
            handleDuplicateSession: 'transfer',
          }),
        ),
      )

      await Promise.all(
        players.map(async (player) => {
          const remoteVideo = player.page.locator('video:not([muted])').first()
          await expect(remoteVideo).toBeVisible({ timeout: 30000 })
          await expectVideoRendering(player.page, 'video:not([muted])')
          await expectAudioEnergy(player.page, 'video:not([muted])')
        }),
      )
    } finally {
      await Promise.all(
        players.map(async (player) => {
          await player.context.close()
          await player.browser.close()
        }),
      )
    }
  })
})
