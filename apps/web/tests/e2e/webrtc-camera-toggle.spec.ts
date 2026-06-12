import { test } from '@playwright/test'

import type { PlayerInfo } from '../helpers/toggle-assertions'
import {
  ensureWorkerStorageState,
  hasAuthCredentials,
} from '../helpers/auth-storage'
import { launchPlayer } from '../helpers/launch-player'
import {
  PLAYER_LABELS,
  waitForAllConnectionsReady,
  waitForRemoteCardCountIntegrity,
} from '../helpers/room-harness'
import { createRoomViaUI, navigateToTestGame } from '../helpers/test-utils'
import {
  clickVideoToggle,
  expectSenderVideoOff,
  expectSenderVideoOn,
  resolvePlayerIds,
} from '../helpers/toggle-assertions'

test.describe('LiveKit camera toggle regression', () => {
  test('camera off then on propagates without sender reload', async ({
    baseURL,
  }) => {
    test.setTimeout(420_000)

    if (!hasAuthCredentials()) {
      test.skip(
        true,
        'E2E auth env vars missing. Set VITE_CONVEX_URL and PREVIEW_LOGIN_CODE.',
      )
    }

    if (!baseURL) {
      throw new Error('Playwright baseURL is not configured.')
    }

    const storageStatePaths = await Promise.all([
      ensureWorkerStorageState(0, baseURL),
      ensureWorkerStorageState(1, baseURL),
    ])
    const players = await Promise.all([
      launchPlayer({
        baseURL,
        storageStatePath: storageStatePaths[0]!,
        toneHz: 440,
        label: PLAYER_LABELS[0]!,
      }),
      launchPlayer({
        baseURL,
        storageStatePath: storageStatePaths[1]!,
        toneHz: 550,
        label: PLAYER_LABELS[1]!,
      }),
    ])

    try {
      const [senderHandle, receiverHandle] = players
      const senderPage = senderHandle!.page
      const receiverPage = receiverHandle!.page

      const roomId = await createRoomViaUI(senderPage)
      await navigateToTestGame(senderPage, roomId)
      await senderPage
        .getByTestId('game-id-display')
        .waitFor({ state: 'visible', timeout: 30_000 })

      await navigateToTestGame(receiverPage, roomId)
      await receiverPage
        .getByTestId('game-id-display')
        .waitFor({ state: 'visible', timeout: 30_000 })

      await Promise.all([
        waitForRemoteCardCountIntegrity(senderPage, 1, PLAYER_LABELS[0]!),
        waitForRemoteCardCountIntegrity(receiverPage, 1, PLAYER_LABELS[1]!),
      ])
      await Promise.all([
        waitForAllConnectionsReady(senderPage, 1, PLAYER_LABELS[0]!),
        waitForAllConnectionsReady(receiverPage, 1, PLAYER_LABELS[1]!),
      ])

      const labels = [PLAYER_LABELS[0]!, PLAYER_LABELS[1]!]
      const playerIds = await resolvePlayerIds(
        [senderPage, receiverPage],
        labels,
      )
      const sender: PlayerInfo = {
        page: senderPage,
        label: labels[0]!,
        playerId: playerIds[0]!,
      }
      const receiver: PlayerInfo = {
        page: receiverPage,
        label: labels[1]!,
        playerId: playerIds[1]!,
      }

      await clickVideoToggle(sender.page)
      await expectSenderVideoOff(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
      )

      await clickVideoToggle(sender.page)
      await expectSenderVideoOn(
        receiver.page,
        sender.playerId,
        `${receiver.label} observing ${sender.label}`,
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
