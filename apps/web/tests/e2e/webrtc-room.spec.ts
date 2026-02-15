import { expect, test } from '@playwright/test'

import {
  ensureWorkerStorageState,
  hasAuthCredentials,
} from '../helpers/auth-storage'
import { launchPlayer } from '../helpers/launch-player'
import {
  collectMediaDiagnostics,
  expectAudioEnergy,
  expectVideoRendering,
  waitForRemoteCardsStable,
} from '../helpers/media-assertions'
import { createRoomViaUI, navigateToTestGame } from '../helpers/test-utils'

test.describe('WebRTC 4-player room', () => {
  test('players join and render remote video/audio', async ({}, testInfo) => {
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires object destructuring
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

    const playerLabels = ['Teferi', 'Jace', 'Chandra', 'Gideon'] as const
    const players = await Promise.all(
      storageStatePaths.map((storageStatePath, index) =>
        launchPlayer({
          baseURL,
          storageStatePath,
          toneHz: 440 + index * 110,
          label: playerLabels[index] ?? `Player ${index + 1}`,
        }),
      ),
    )

    const consoleLogsByPlayer: string[][] = players.map(() => [])
    players.forEach((player, index) => {
      const appendLog = (entry: string) => {
        const logs = consoleLogsByPlayer[index]
        if (!logs) return
        logs.push(entry)
        if (logs.length > 250) logs.shift()
      }

      player.page.on('console', (msg) => {
        const type = msg.type()
        if (type !== 'debug' && type !== 'warning' && type !== 'error') return
        appendLog(`[console:${type}] ${msg.text()}`)
      })

      player.page.on('pageerror', (error) => {
        appendLog(`[pageerror] ${error.message}`)
      })
    })

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

      // Let WebRTC establish all peer connections (especially owner's 3 outbound)
      // and remote track state to settle before requiring every remote card stable.
      // 30s gives more headroom for 4-peer mesh + mock media under load.
      await new Promise((r) => setTimeout(r, 30_000))

      const attachFailureDiagnostics = async (
        failure: unknown,
      ): Promise<void> => {
        await Promise.all(
          players.map(async (player, index) => {
            const playerLabel = playerLabels[index] ?? `player-${index + 1}`

            const mediaDiagnostics = await collectMediaDiagnostics(
              player.page,
              'video:not([muted])',
            ).catch((error: unknown) => ({
              error: String(error),
            }))
            await testInfo.attach(`webrtc-media-${playerLabel}`, {
              body: Buffer.from(JSON.stringify(mediaDiagnostics, null, 2)),
              contentType: 'application/json',
            })

            const consoleLogs = consoleLogsByPlayer[index] ?? []
            if (consoleLogs.length > 0) {
              await testInfo.attach(`webrtc-console-${playerLabel}`, {
                body: Buffer.from(consoleLogs.join('\n')),
                contentType: 'text/plain',
              })
            }

            const screenshotBuffer = await player.page
              .screenshot({ fullPage: true })
              .catch(() => null)
            if (screenshotBuffer) {
              await testInfo.attach(`webrtc-screenshot-${playerLabel}`, {
                body: screenshotBuffer,
                contentType: 'image/png',
              })
            }
          }),
        )

        await testInfo.attach('webrtc-failure-summary', {
          body: Buffer.from(String(failure)),
          contentType: 'text/plain',
        })
      }

      try {
        for (let index = 0; index < players.length; index += 1) {
          const player = players[index]
          if (!player)
            throw new Error(`Player at index ${index} not initialized`)
          const playerLabel = playerLabels[index] ?? `player-${index + 1}`
          try {
            // Require all 3 remotes stable so we catch missing/broken streams (e.g. "Camera Off").
            const remoteStates = await waitForRemoteCardsStable(player.page, 3)

            for (const state of remoteStates) {
              const cardSelector = `[data-testid="remote-player-card"][data-player-id="${state.playerId}"]`
              const videoSelector = `${cardSelector} [data-testid="remote-player-video"]`
              const card = player.page.locator(cardSelector)

              await expect(card).toBeVisible({ timeout: 30_000 })
              await expect(
                card.locator('[data-testid="remote-player-video-off"]'),
              ).toHaveCount(0)
              await expect(
                card.locator('[data-testid="remote-player-offline-warning"]'),
              ).toHaveCount(0)
              await expect(
                card.locator('[data-testid="remote-player-webrtc-warning"]'),
              ).toHaveCount(0)

              await expectVideoRendering(player.page, videoSelector)
              await expectAudioEnergy(player.page, videoSelector)
            }
          } catch (error) {
            throw new Error(
              `${playerLabel} media assertion failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            )
          }
        }
      } catch (error) {
        await attachFailureDiagnostics(error)
        throw error
      }
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
