import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import type { PlayerHandle } from '../helpers/launch-player'
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

const PLAYER_LABELS = ['Teferi', 'Jace', 'Chandra', 'Gideon'] as const
const PLAYER_COUNT = 4
const EXPECTED_REMOTES = PLAYER_COUNT - 1
const MAX_ALLOWED_CONNECTING_MS = 25_000

type RemoteCardSnapshotState = {
  playerId: string
  playerName: string
  hasVideo: boolean
  hasVideoOff: boolean
  connState: string | null
  hasOffline: boolean
  stable: boolean
}

type RemoteCardSnapshot = {
  cardCount: number
  stableCount: number
  allStable: boolean
  states: RemoteCardSnapshotState[]
}

type RemoteTimelineEntry = {
  elapsedMs: number
  cardCount: number
  stableCount: number
  connectingCount: number
}

/**
 * Collect WebRTC-level peer connection diagnostics from a player's page.
 * Returns connection/ICE states and track info for every RTCPeerConnection.
 */
async function collectWebRTCPeerDiagnostics(page: Page) {
  return page.evaluate(() => {
    const pcs = (
      window as unknown as { __rtcPeerConnections?: RTCPeerConnection[] }
    ).__rtcPeerConnections
    if (!pcs || pcs.length === 0) return { captured: false, peers: [] }

    return {
      captured: true,
      peers: pcs.map((pc, i) => {
        const senders = pc.getSenders().map((s) => ({
          kind: s.track?.kind ?? null,
          enabled: s.track?.enabled ?? null,
          readyState: s.track?.readyState ?? null,
          muted: s.track?.muted ?? null,
        }))
        const receivers = pc.getReceivers().map((r) => ({
          kind: r.track?.kind ?? null,
          enabled: r.track?.enabled ?? null,
          readyState: r.track?.readyState ?? null,
          muted: r.track?.muted ?? null,
        }))
        return {
          index: i,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          iceGatheringState: pc.iceGatheringState,
          signalingState: pc.signalingState,
          localDescriptionType: pc.localDescription?.type ?? null,
          remoteDescriptionType: pc.remoteDescription?.type ?? null,
          senders,
          receivers,
        }
      }),
    }
  })
}

/**
 * Inject a global hook to capture all RTCPeerConnection instances for diagnostics.
 */
async function injectPeerConnectionCapture(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __rtcPeerConnections: RTCPeerConnection[]
    }
    win.__rtcPeerConnections = []
    const OrigPC = RTCPeerConnection
    ;(
      window as unknown as { RTCPeerConnection: typeof RTCPeerConnection }
    ).RTCPeerConnection = class extends OrigPC {
      constructor(config?: RTCConfiguration) {
        super(config)
        win.__rtcPeerConnections.push(this)
      }
    }
  })
}

/**
 * Wait until all remote cards on a page show connectionState "connected"
 * for every peer, with polling and detailed progress logging.
 */
async function waitForAllConnectionsReady(
  page: Page,
  expectedRemotes: number,
  _label: string,
  timeoutMs = 120_000,
): Promise<{
  ready: boolean
  elapsed: number
  lastSnapshot: RemoteCardSnapshot | null
  timeline: RemoteTimelineEntry[]
  maxConnectingDurationsMs: Record<string, number>
}> {
  const start = Date.now()
  let lastSnapshot: RemoteCardSnapshot | null = null
  let pollInterval = 2_000
  const timeline: RemoteTimelineEntry[] = []
  const connectingSinceMs = new Map<string, number>()
  const maxConnectingDurationsMs: Record<string, number> = {}

  while (Date.now() - start < timeoutMs) {
    const snapshot = await page.evaluate((expected): RemoteCardSnapshot => {
      const cards = Array.from(
        document.querySelectorAll('[data-testid="remote-player-card"]'),
      )
      const states = cards.map((card) => {
        const playerId = card.getAttribute('data-player-id') ?? '?'
        const playerName =
          card.querySelector('.text-white')?.textContent?.trim() ?? '?'
        const hasVideo = !!card.querySelector(
          '[data-testid="remote-player-video"]',
        )
        const hasVideoOff = !!card.querySelector(
          '[data-testid="remote-player-video-off"]',
        )
        const webrtcWarning = card.querySelector(
          '[data-testid="remote-player-webrtc-warning"]',
        )
        const connState =
          webrtcWarning?.getAttribute('data-connection-state') ?? null
        const hasOffline = !!card.querySelector(
          '[data-testid="remote-player-offline-warning"]',
        )
        return {
          playerId,
          playerName,
          hasVideo,
          hasVideoOff,
          connState,
          hasOffline,
          stable: hasVideo && !hasVideoOff && !connState && !hasOffline,
        }
      })
      const stableCount = states.filter((s) => s.stable).length
      return {
        cardCount: cards.length,
        stableCount,
        allStable: states.length === expected && stableCount === expected,
        states,
      }
    }, expectedRemotes)

    lastSnapshot = snapshot
    const now = Date.now()
    const observedPeerIds = new Set(snapshot.states.map((s) => s.playerId))
    for (const state of snapshot.states) {
      if (state.connState === 'connecting') {
        const since = connectingSinceMs.get(state.playerId) ?? now
        if (!connectingSinceMs.has(state.playerId)) {
          connectingSinceMs.set(state.playerId, since)
        }
        const duration = now - since
        const prevMax = maxConnectingDurationsMs[state.playerId] ?? 0
        if (duration > prevMax) {
          maxConnectingDurationsMs[state.playerId] = duration
        }
      } else {
        connectingSinceMs.delete(state.playerId)
      }
    }
    for (const trackedPeerId of Array.from(connectingSinceMs.keys())) {
      if (!observedPeerIds.has(trackedPeerId)) {
        connectingSinceMs.delete(trackedPeerId)
      }
    }
    timeline.push({
      elapsedMs: now - start,
      cardCount: snapshot.cardCount,
      stableCount: snapshot.stableCount,
      connectingCount: snapshot.states.filter(
        (s) => s.connState === 'connecting',
      ).length,
    })
    if (timeline.length > 80) timeline.shift()

    if (snapshot.allStable) {
      return {
        ready: true,
        elapsed: Date.now() - start,
        lastSnapshot,
        timeline,
        maxConnectingDurationsMs,
      }
    }

    await new Promise((r) => setTimeout(r, pollInterval))
    pollInterval = Math.min(pollInterval + 500, 5_000)
  }

  return {
    ready: false,
    elapsed: Date.now() - start,
    lastSnapshot,
    timeline,
    maxConnectingDurationsMs,
  }
}

async function waitForRemoteCardCountIntegrity(
  page: Page,
  expectedRemotes: number,
  label: string,
  timeoutMs = 45_000,
): Promise<RemoteCardSnapshot> {
  const start = Date.now()
  let lastSnapshot: RemoteCardSnapshot | null = null

  while (Date.now() - start < timeoutMs) {
    const snapshot = await page.evaluate((expected): RemoteCardSnapshot => {
      const cards = Array.from(
        document.querySelectorAll('[data-testid="remote-player-card"]'),
      )
      const states = cards.map((card) => {
        const playerId = card.getAttribute('data-player-id') ?? '?'
        const playerName =
          card.querySelector('.text-white')?.textContent?.trim() ?? '?'
        const hasVideo = !!card.querySelector(
          '[data-testid="remote-player-video"]',
        )
        const hasVideoOff = !!card.querySelector(
          '[data-testid="remote-player-video-off"]',
        )
        const webrtcWarning = card.querySelector(
          '[data-testid="remote-player-webrtc-warning"]',
        )
        const connState =
          webrtcWarning?.getAttribute('data-connection-state') ?? null
        const hasOffline = !!card.querySelector(
          '[data-testid="remote-player-offline-warning"]',
        )
        return {
          playerId,
          playerName,
          hasVideo,
          hasVideoOff,
          connState,
          hasOffline,
          stable: hasVideo && !hasVideoOff && !connState && !hasOffline,
        }
      })
      const stableCount = states.filter((s) => s.stable).length
      return {
        cardCount: cards.length,
        stableCount,
        allStable: states.length === expected && stableCount === expected,
        states,
      }
    }, expectedRemotes)
    lastSnapshot = snapshot

    const ids = snapshot.states.map((s) => s.playerId)
    const hasUnknownId = ids.some((id) => id === '?')
    const duplicateIds = ids.filter((id, idx) => ids.indexOf(id) !== idx)
    if (
      snapshot.cardCount === expectedRemotes &&
      !hasUnknownId &&
      duplicateIds.length === 0
    ) {
      return snapshot
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  throw new Error(
    `${label}: remote card integrity failed after ${timeoutMs}ms. Last snapshot: ${JSON.stringify(lastSnapshot)}`,
  )
}

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

    // --- Phase 1: Setup auth storage for all players ---
    const assignedUserIds = new Set<string>()
    const storageStatePaths: string[] = []
    for (const index of [0, 1, 2, 3]) {
      storageStatePaths.push(
        await ensureWorkerStorageState(index, baseURL, { assignedUserIds }),
      )
    }

    // --- Phase 2: Launch browser instances ---
    const players: PlayerHandle[] = []
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const sp = storageStatePaths[i]!
      const player = await launchPlayer({
        baseURL,
        storageStatePath: sp,
        toneHz: 440 + i * 110,
        label: PLAYER_LABELS[i]!,
      })
      await injectPeerConnectionCapture(player.page)
      players.push(player)
    }

    // --- Phase 3: Set up console log capture ---
    const consoleLogsByPlayer: string[][] = players.map(() => [])
    players.forEach((player, index) => {
      const appendLog = (entry: string) => {
        const logs = consoleLogsByPlayer[index]!
        logs.push(entry)
        if (logs.length > 500) logs.shift()
      }

      player.page.on('console', (msg) => {
        const text = msg.text()
        const type = msg.type()
        // Capture all WebRTC/signaling-related logs regardless of type
        if (
          text.includes('[WebRTC') ||
          text.includes('[ConvexWebRTC') ||
          text.includes('[ConvexSignaling') ||
          text.includes('[VideoStreamGrid') ||
          text.includes('[useVideoStreamAttachment') ||
          type === 'error' ||
          type === 'warning'
        ) {
          appendLog(`[console:${type}] ${text}`)
        }
      })

      player.page.on('pageerror', (error) => {
        appendLog(`[pageerror] ${error.message}`)
      })
    })

    const owner = players[0]!

    try {
      // --- Phase 4: Create room and navigate owner ---
      const roomId = await createRoomViaUI(owner.page)
      await navigateToTestGame(owner.page, roomId, {
        handleDuplicateSession: 'transfer',
      })

      await owner.page
        .getByTestId('game-id-display')
        .waitFor({ state: 'visible', timeout: 30_000 })

      // Give owner time for presence registration and local stream setup
      await new Promise((r) => setTimeout(r, 8_000))

      // --- Phase 5: Join players one-by-one with intermediate checks ---
      const joiners = players.slice(1)
      for (let i = 0; i < joiners.length; i++) {
        const joiner = joiners[i]!
        const joinerLabel = PLAYER_LABELS[i + 1]!

        await navigateToTestGame(joiner.page, roomId, {
          handleDuplicateSession: 'transfer',
        })

        // Wait for the joiner's page to fully load (the game page should render participant info)
        await joiner.page
          .waitForLoadState('networkidle', { timeout: 30_000 })
          .catch(() => {})
        await joiner.page
          .getByTestId('game-id-display')
          .waitFor({ state: 'visible', timeout: 30_000 })
          .catch(() => {
            console.log(
              `[Test] Warning: ${joinerLabel} game-id-display not visible after 30s`,
            )
          })

        // Check for page errors on the joiner
        const joinerPageErrors = (consoleLogsByPlayer[i + 1] ?? []).filter(
          (l) => l.includes('[pageerror]'),
        )
        if (joinerPageErrors.length > 0) {
          console.log(
            `[Test] Warning: ${joinerLabel} has page errors:`,
            joinerPageErrors.join('; '),
          )
        }

        // Allow time for signaling and peer connection establishment
        const settleMs = 12_000
        await new Promise((r) => setTimeout(r, settleMs))

        // Progress check + integrity assertion: all currently joined players
        // should eventually render the expected number of unique remote cards.
        for (let p = 0; p <= i + 1; p++) {
          const pLabel = PLAYER_LABELS[p]!
          const pPage = players[p]!.page
          const expectedAtThisStage = i + 1
          const snapshot = await waitForRemoteCardCountIntegrity(
            pPage,
            expectedAtThisStage,
            `${pLabel} after ${joinerLabel} joined`,
          )
          console.log(
            `[Test] After ${joinerLabel} joined, ${pLabel} sees:`,
            JSON.stringify(
              snapshot.states.map((s) => ({
                pid: s.playerId,
                name: s.playerName,
                hasVideo: s.hasVideo,
                connState: s.connState,
              })),
            ),
          )
        }
      }

      // --- Phase 6: Wait for all connections to stabilize ---
      // Poll all players for full connectivity instead of a flat wait
      let stabilityResults: Array<{
        label: string
        ready: boolean
        elapsed: number
        lastSnapshot: RemoteCardSnapshot | null
        timeline: RemoteTimelineEntry[]
        maxConnectingDurationsMs: Record<string, number>
      }> = []
      stabilityResults = await Promise.all(
        players.map(async (player, idx) => {
          const label = PLAYER_LABELS[idx]!
          const result = await waitForAllConnectionsReady(
            player.page,
            EXPECTED_REMOTES,
            label,
            120_000,
          )
          console.log(
            `[Test] ${label} connection readiness: ready=${result.ready}, elapsed=${result.elapsed}ms`,
          )
          console.log(
            `[Test] ${label} max connecting durations (ms): ${JSON.stringify(result.maxConnectingDurationsMs)}`,
          )
          if (!result.ready) {
            console.log(
              `[Test] ${label} last snapshot:`,
              JSON.stringify(result.lastSnapshot, null, 2),
            )
            console.log(
              `[Test] ${label} timeline tail:`,
              JSON.stringify(result.timeline.slice(-12), null, 2),
            )
          }
          return { label, ...result }
        }),
      )

      const allReady = stabilityResults.every((r) => r.ready)
      if (!allReady) {
        const notReady = stabilityResults
          .filter((r) => !r.ready)
          .map((r) => r.label)
        console.log(
          `[Test] Not all players ready after polling. Failing players: ${notReady.join(', ')}`,
        )

        // Dump detailed WebRTC peer diagnostics and full console logs for failing players
        for (let idx = 0; idx < players.length; idx++) {
          const label = PLAYER_LABELS[idx]!
          const player = players[idx]!

          const peerDiag = await collectWebRTCPeerDiagnostics(
            player.page,
          ).catch(() => ({ captured: false, peers: [] }))
          console.log(
            `[Test] ${label} WebRTC peers:`,
            JSON.stringify(peerDiag, null, 2),
          )

          const logs = consoleLogsByPlayer[idx] ?? []
          console.log(
            `[Test] ${label} console logs (last 50):`,
            logs.slice(-50).join('\n'),
          )
        }
      }

      // Assert that peers don't remain in "connecting" for too long.
      // This catches regressions where streams eventually recover but the
      // room spends a long time in degraded video/audio state.
      for (const result of stabilityResults) {
        const maxObserved = Math.max(
          0,
          ...Object.values(result.maxConnectingDurationsMs),
        )
        expect(
          maxObserved,
          `${result.label}: connecting state lasted too long (${maxObserved}ms > ${MAX_ALLOWED_CONNECTING_MS}ms). Timeline and diagnostics are attached on failure.`,
        ).toBeLessThanOrEqual(MAX_ALLOWED_CONNECTING_MS)
      }

      // --- Phase 7: Diagnostics attachment helper ---
      const attachFailureDiagnostics = async (
        failure: unknown,
      ): Promise<void> => {
        const failureMessage = String(
          failure instanceof Error ? failure.message : failure,
        )
        const failedPlayerMatch = failureMessage.match(
          /^(\w+)(?: media assertion failed:|: expected all active RTCPeerConnections)/,
        )
        const failedPlayerLabel = failedPlayerMatch?.[1] ?? 'unknown'

        const stabilityReports: Array<{
          label: string
          report: Awaited<ReturnType<typeof collectRemoteCardsStabilityReport>>
        }> = []

        await Promise.all(
          players.map(async (player, index) => {
            const playerLabel = PLAYER_LABELS[index] ?? `player-${index + 1}`

            const stabilityReport = await collectRemoteCardsStabilityReport(
              player.page,
              EXPECTED_REMOTES,
            ).catch((error: unknown) => ({
              cards: [],
              stableCount: 0,
              unstableCount: 0,
              expectedCount: EXPECTED_REMOTES,
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
            ).catch((error: unknown) => ({ error: String(error) }))
            await testInfo.attach(`webrtc-media-${playerLabel}`, {
              body: Buffer.from(JSON.stringify(mediaDiagnostics, null, 2)),
              contentType: 'application/json',
            })

            // Collect WebRTC peer connection diagnostics
            const peerDiag = await collectWebRTCPeerDiagnostics(
              player.page,
            ).catch((error: unknown) => ({
              captured: false,
              peers: [],
              error: String(error),
            }))
            await testInfo.attach(`webrtc-peers-${playerLabel}`, {
              body: Buffer.from(JSON.stringify(peerDiag, null, 2)),
              contentType: 'application/json',
            })

            const stabilityResult = stabilityResults.find(
              (r) => r.label === playerLabel,
            )
            if (stabilityResult) {
              await testInfo.attach(
                `webrtc-connection-timeline-${playerLabel}`,
                {
                  body: Buffer.from(
                    JSON.stringify(
                      {
                        ready: stabilityResult.ready,
                        elapsed: stabilityResult.elapsed,
                        maxConnectingDurationsMs:
                          stabilityResult.maxConnectingDurationsMs,
                        timeline: stabilityResult.timeline,
                        lastSnapshot: stabilityResult.lastSnapshot,
                      },
                      null,
                      2,
                    ),
                    'utf-8',
                  ),
                  contentType: 'application/json',
                },
              )
            }

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
          'Unstable cards by player:',
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

      // --- Phase 8: Assert media for each player ---
      try {
        // Assert that active peer connections have converged by the time media
        // assertions run. Closed peer connections are tracked for diagnostics,
        // because reconnect churn can legitimately leave historical closed PCs.
        for (let index = 0; index < players.length; index++) {
          const player = players[index]!
          const playerLabel = PLAYER_LABELS[index]!
          const peerDiag = await collectWebRTCPeerDiagnostics(player.page)
          if (peerDiag.captured) {
            const closedPeers = peerDiag.peers.filter(
              (peer) => peer.connectionState === 'closed',
            )
            if (closedPeers.length > 0) {
              console.log(
                `[Test] ${playerLabel} observed closed RTCPeerConnections (expected possible churn): ${closedPeers.length}`,
              )
            }

            const activePeers = peerDiag.peers.filter(
              (peer) =>
                peer.connectionState !== 'closed' &&
                peer.signalingState !== 'closed',
            )
            const nonConnectedActivePeers = activePeers.filter(
              (peer) => peer.connectionState !== 'connected',
            )
            expect(
              activePeers.length >= EXPECTED_REMOTES,
              `${playerLabel}: expected at least ${EXPECTED_REMOTES} active RTCPeerConnections before media asserts; activePeers=${JSON.stringify(
                activePeers,
                null,
                2,
              )}`,
            ).toBeTruthy()
            expect(
              nonConnectedActivePeers.length,
              `${playerLabel}: expected all active RTCPeerConnections connected before media asserts; non-connected-active peers=${JSON.stringify(
                nonConnectedActivePeers,
                null,
                2,
              )}`,
            ).toBe(0)
          }
        }

        for (let index = 0; index < players.length; index++) {
          const player = players[index]!
          const playerLabel = PLAYER_LABELS[index]!
          try {
            const remoteStates = await waitForRemoteCardsStable(
              player.page,
              EXPECTED_REMOTES,
              { context: playerLabel },
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
