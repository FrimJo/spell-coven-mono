import { expect, test } from '@playwright/test'

import {
  ensureWorkerStorageState,
  hasAuthCredentials,
} from '../helpers/auth-storage'
import { launchPlayer } from '../helpers/launch-player'
import {
  collectMediaDiagnostics,
  collectRemoteCardsStabilityReport,
  expectAudioEnergy,
  expectVideoRendering,
  waitForRemoteCardsStable,
} from '../helpers/media-assertions'
import { createRoomViaUI, navigateToTestGame } from '../helpers/test-utils'

test.describe('WebRTC 4-player room', () => {
  test('players join and render remote video/audio', async ({}, testInfo) => {
    // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires object destructuring
    test.setTimeout(300_000)

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

      // Ensure owner is on game page and has had time for presence + media before anyone joins.
      // This avoids creator being unable to see joiners / joiners unable to see creator (signaling
      // and initiation depend on presence and local stream).
      await owner.page
        .getByTestId('game-id-display')
        .waitFor({ state: 'visible', timeout: 30_000 })
      await new Promise((r) => setTimeout(r, 10_000))

      // Stagger joiner entry so the mesh establishes one-by-one instead of all at once.
      const joiners = players.slice(1)
      for (let i = 0; i < joiners.length; i += 1) {
        const player = joiners[i]
        if (!player) continue
        await navigateToTestGame(player.page, roomId, {
          handleDuplicateSession: 'transfer',
        })
        if (i < joiners.length - 1) {
          await new Promise((r) => setTimeout(r, 8_000))
        }
      }

      // Let WebRTC establish all peer connections and remote track state to settle.
      await new Promise((r) => setTimeout(r, 60_000))

      const attachFailureDiagnostics = async (
        failure: unknown,
      ): Promise<void> => {
        const failureMessage = String(
          failure instanceof Error ? failure.message : failure,
        )
        const failedPlayerMatch = failureMessage.match(
          /^(\w+) media assertion failed:/,
        )
        const failedPlayerLabel = failedPlayerMatch?.[1] ?? 'unknown'

        const stabilityReports: Array<{
          label: string
          report: Awaited<ReturnType<typeof collectRemoteCardsStabilityReport>>
        }> = []

        await Promise.all(
          players.map(async (player, index) => {
            const playerLabel = playerLabels[index] ?? `player-${index + 1}`

            const stabilityReport = await collectRemoteCardsStabilityReport(
              player.page,
              3,
            ).catch((error: unknown) => ({
              cards: [],
              stableCount: 0,
              unstableCount: 0,
              expectedCount: 3,
              summary: `Failed to collect: ${String(error)}`,
              unstableCards: [],
              collectedAt: new Date().toISOString(),
            }))
            stabilityReports.push({
              label: playerLabel,
              report: stabilityReport,
            })
            await testInfo.attach(`webrtc-remote-cards-${playerLabel}`, {
              body: Buffer.from(
                JSON.stringify(stabilityReport, null, 2),
                'utf-8',
              ),
              contentType: 'application/json',
            })

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

        const contextLines: string[] = [
          '=== WebRTC room test failure context ===',
          '',
          `Failed at: ${failedPlayerLabel}`,
          '',
          'Per-player remote card stability (at failure time):',
          ...stabilityReports.map(
            ({ label, report }) =>
              `  ${label}: ${report.summary} (collected ${report.collectedAt})`,
          ),
          '',
          'Unstable cards by player (check webrtc-remote-cards-*.json for full details):',
          ...stabilityReports.flatMap(({ label, report }) =>
            report.unstableCards.length > 0
              ? [
                  `  ${label}:`,
                  ...report.unstableCards.map(
                    (u) =>
                      `    - ${u.playerId}${u.playerName ? ` (${u.playerName})` : ''}: ${u.reason}${u.webrtcConnectionState ? ` [connectionState=${u.webrtcConnectionState}]` : ''}`,
                  ),
                ]
              : [],
          ),
          '',
          'Attachments to inspect:',
          '  - webrtc-remote-cards-<Player>: per-player card states and unstable reasons',
          '  - webrtc-media-<Player>: video/audio element diagnostics',
          '  - webrtc-console-<Player>: console logs',
          '  - webrtc-screenshot-<Player>: full-page screenshot',
          '',
          '--- Failure message ---',
          failureMessage,
        ]

        await testInfo.attach('webrtc-failure-context', {
          body: Buffer.from(contextLines.join('\n'), 'utf-8'),
          contentType: 'text/plain',
        })
        await testInfo.attach('webrtc-failure-summary', {
          body: Buffer.from(failureMessage, 'utf-8'),
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
            const remoteStates = await waitForRemoteCardsStable(
              player.page,
              3,
              {
                context: playerLabel,
              },
            )

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
