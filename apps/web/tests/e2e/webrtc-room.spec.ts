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
import { createRoomViaUI, navigateToTestGame } from '../helpers/test-utils'

test.describe('WebRTC 4-player room', () => {
  test('players join and render remote video/audio', // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires object destructuring
  async ({}, testInfo) => {
    test.setTimeout(180_000)

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

    const assignedUserIds = new Set<string>()
    const storageStatePaths: string[] = []
    for (const index of [0, 1, 2, 3]) {
      storageStatePaths.push(
        await ensureWorkerStorageState(index, baseURL, { assignedUserIds }),
      )
    }

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
    const owner = players[0]
    if (!owner) {
      throw new Error('Expected room owner player to be initialized.')
    }

    try {
      const roomId = await createRoomViaUI(owner.page)
      await navigateToTestGame(owner.page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      await Promise.all(
        players.slice(1).map((player) =>
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
