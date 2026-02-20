/**
 * Reusable 4-player room bootstrap harness for WebRTC E2E tests.
 *
 * Extracts the deterministic launch → join → stabilize → diagnose lifecycle
 * from the baseline webrtc-room spec so that toggle-matrix, torture, and
 * future specs can share the same setup without duplication.
 */

import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import type { PlayerHandle } from './launch-player'
import { ensureWorkerStorageState, hasAuthCredentials } from './auth-storage'
import { launchPlayer } from './launch-player'
import {
  collectMediaDiagnostics,
  collectRemoteCardsStabilityReport,
  expectAudioEnergy,
  expectVideoRendering,
  waitForRemoteCardsStable,
} from './media-assertions'
import { createRoomViaUI, navigateToTestGame } from './test-utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Must match backend preview names for worker slots 0..3. See convex/previewLogin.ts
// pickPreviewNameForSlot(slot) → PREVIEW_NAMES[slot % PREVIEW_NAMES.length].
export const PLAYER_LABELS = ['Jace', 'Chandra', 'Liliana', 'Gideon'] as const
export const PLAYER_COUNT = 4
export const EXPECTED_REMOTES = PLAYER_COUNT - 1
export const MAX_ALLOWED_CONNECTING_MS = 25_000

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RemoteCardSnapshotState = {
  playerId: string
  playerName: string
  hasVideo: boolean
  hasVideoOff: boolean
  connState: string | null
  hasOffline: boolean
  stable: boolean
}

export type RemoteCardSnapshot = {
  cardCount: number
  stableCount: number
  allStable: boolean
  states: RemoteCardSnapshotState[]
}

export type RemoteTimelineEntry = {
  elapsedMs: number
  cardCount: number
  stableCount: number
  connectingCount: number
}

export type StabilityResult = {
  label: string
  ready: boolean
  elapsed: number
  lastSnapshot: RemoteCardSnapshot | null
  timeline: RemoteTimelineEntry[]
  maxConnectingDurationsMs: Record<string, number>
}

export type RoomHarness = {
  players: PlayerHandle[]
  roomId: string
  consoleLogsByPlayer: string[][]
  stabilityResults: StabilityResult[]
  /** Attach comprehensive diagnostics to the Playwright report on failure. */
  attachFailureDiagnostics: (
    failure: unknown,
    testInfo: TestInfo,
  ) => Promise<void>
  /** Tear down all browser instances. */
  teardown: () => Promise<void>
}

// ---------------------------------------------------------------------------
// WebRTC peer connection capture & diagnostics
// ---------------------------------------------------------------------------

export async function injectPeerConnectionCapture(page: Page) {
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

export async function collectWebRTCPeerDiagnostics(page: Page) {
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

// ---------------------------------------------------------------------------
// Connection readiness polling
// ---------------------------------------------------------------------------

export async function waitForAllConnectionsReady(
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

// ---------------------------------------------------------------------------
// Remote card integrity polling
// ---------------------------------------------------------------------------

export async function waitForRemoteCardCountIntegrity(
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

// ---------------------------------------------------------------------------
// Full room bootstrap (launch → create → join → stabilize)
// ---------------------------------------------------------------------------

export interface SetupRoomOptions {
  baseURL: string
  /** Playwright TestInfo used for diagnostics attachment. */
  testInfo: TestInfo
}

/**
 * Bootstrap a fully-connected 4-player room.
 *
 * Returns a harness object that owns the browser instances and provides
 * diagnostics helpers. Callers MUST call `harness.teardown()` in a finally
 * block.
 */
export async function setupStableRoom(
  opts: SetupRoomOptions,
): Promise<RoomHarness> {
  if (!hasAuthCredentials()) {
    throw new Error(
      'E2E auth env vars missing. Set VITE_CONVEX_URL and PREVIEW_LOGIN_CODE.',
    )
  }

  const { baseURL } = opts

  // Phase 1: Auth storage
  const assignedUserIds = new Set<string>()
  const storageStatePaths: string[] = []
  for (const index of [0, 1, 2, 3]) {
    storageStatePaths.push(
      await ensureWorkerStorageState(index, baseURL, { assignedUserIds }),
    )
  }

  // Phase 2: Launch browser instances
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

  // Phase 3: Console capture
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

  // Phase 4: Create room via owner
  const owner = players[0]!
  const roomId = await createRoomViaUI(owner.page)
  await navigateToTestGame(owner.page, roomId, {
    handleDuplicateSession: 'transfer',
  })
  await owner.page
    .getByTestId('game-id-display')
    .waitFor({ state: 'visible', timeout: 30_000 })
  await new Promise((r) => setTimeout(r, 8_000))

  // Phase 5: Join players sequentially with integrity checks
  const joiners = players.slice(1)
  for (let i = 0; i < joiners.length; i++) {
    const joiner = joiners[i]!
    const joinerLabel = PLAYER_LABELS[i + 1]!

    await navigateToTestGame(joiner.page, roomId, {
      handleDuplicateSession: 'transfer',
    })
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

    const joinerPageErrors = (consoleLogsByPlayer[i + 1] ?? []).filter((l) =>
      l.includes('[pageerror]'),
    )
    if (joinerPageErrors.length > 0) {
      console.log(
        `[Test] Warning: ${joinerLabel} has page errors:`,
        joinerPageErrors.join('; '),
      )
    }

    await new Promise((r) => setTimeout(r, 12_000))

    for (let p = 0; p <= i + 1; p++) {
      const pLabel = PLAYER_LABELS[p]!
      const pPage = players[p]!.page
      const expectedAtThisStage = i + 1
      await waitForRemoteCardCountIntegrity(
        pPage,
        expectedAtThisStage,
        `${pLabel} after ${joinerLabel} joined`,
      )
    }
  }

  // Phase 6: Wait for all connections to stabilize
  const stabilityResults: StabilityResult[] = await Promise.all(
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
      if (!result.ready) {
        console.log(
          `[Test] ${label} last snapshot:`,
          JSON.stringify(result.lastSnapshot, null, 2),
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
    console.log(`[Test] Not all players ready. Failing: ${notReady.join(', ')}`)
    for (let idx = 0; idx < players.length; idx++) {
      const peerDiag = await collectWebRTCPeerDiagnostics(
        players[idx]!.page,
      ).catch(() => ({ captured: false, peers: [] }))
      console.log(
        `[Test] ${PLAYER_LABELS[idx]} WebRTC peers:`,
        JSON.stringify(peerDiag, null, 2),
      )
    }
  }

  for (const result of stabilityResults) {
    const maxObserved = Math.max(
      0,
      ...Object.values(result.maxConnectingDurationsMs),
    )
    expect(
      maxObserved,
      `${result.label}: connecting state lasted too long (${maxObserved}ms > ${MAX_ALLOWED_CONNECTING_MS}ms).`,
    ).toBeLessThanOrEqual(MAX_ALLOWED_CONNECTING_MS)
  }

  // Build diagnostics attachment helper
  const attachFailureDiagnostics = async (
    failure: unknown,
    ti: TestInfo,
  ): Promise<void> => {
    const failureMessage = String(
      failure instanceof Error ? failure.message : failure,
    )

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
        stabilityReports.push({ label: playerLabel, report: stabilityReport })

        await ti.attach(`webrtc-remote-cards-${playerLabel}`, {
          body: Buffer.from(JSON.stringify(stabilityReport, null, 2), 'utf-8'),
          contentType: 'application/json',
        })

        const mediaDiagnostics = await collectMediaDiagnostics(
          player.page,
          'video:not([muted])',
        ).catch((error: unknown) => ({ error: String(error) }))
        await ti.attach(`webrtc-media-${playerLabel}`, {
          body: Buffer.from(JSON.stringify(mediaDiagnostics, null, 2)),
          contentType: 'application/json',
        })

        const peerDiag = await collectWebRTCPeerDiagnostics(player.page).catch(
          (error: unknown) => ({
            captured: false,
            peers: [],
            error: String(error),
          }),
        )
        await ti.attach(`webrtc-peers-${playerLabel}`, {
          body: Buffer.from(JSON.stringify(peerDiag, null, 2)),
          contentType: 'application/json',
        })

        const stabilityResult = stabilityResults.find(
          (r) => r.label === playerLabel,
        )
        if (stabilityResult) {
          await ti.attach(`webrtc-connection-timeline-${playerLabel}`, {
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
          })
        }

        const consoleLogs = consoleLogsByPlayer[index] ?? []
        if (consoleLogs.length > 0) {
          await ti.attach(`webrtc-console-${playerLabel}`, {
            body: Buffer.from(consoleLogs.join('\n')),
            contentType: 'text/plain',
          })
        }

        const screenshotBuffer = await player.page
          .screenshot({ fullPage: true })
          .catch(() => null)
        if (screenshotBuffer) {
          await ti.attach(`webrtc-screenshot-${playerLabel}`, {
            body: screenshotBuffer,
            contentType: 'image/png',
          })
        }
      }),
    )

    const contextLines: string[] = [
      '=== WebRTC room test failure context ===',
      '',
      'Per-player remote card stability (at failure time):',
      ...stabilityReports.map(
        ({ label, report }) =>
          `  ${label}: ${report.summary} (collected ${report.collectedAt})`,
      ),
      '',
      '--- Failure message ---',
      failureMessage,
    ]

    await ti.attach('webrtc-failure-context', {
      body: Buffer.from(contextLines.join('\n'), 'utf-8'),
      contentType: 'text/plain',
    })
  }

  const teardown = async () => {
    await Promise.all(
      players.map(async (player) => {
        await player.context.close()
        await player.browser.close()
      }),
    )
  }

  return {
    players,
    roomId,
    consoleLogsByPlayer,
    stabilityResults,
    attachFailureDiagnostics,
    teardown,
  }
}

// ---------------------------------------------------------------------------
// Full-room media assertion (all players see all remotes with video+audio)
// ---------------------------------------------------------------------------

export async function assertAllPlayersMediaHealthy(
  harness: RoomHarness,
  testInfo: TestInfo,
) {
  try {
    for (let index = 0; index < harness.players.length; index++) {
      const player = harness.players[index]!
      const playerLabel = PLAYER_LABELS[index]!
      const peerDiag = await collectWebRTCPeerDiagnostics(player.page)
      if (peerDiag.captured) {
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
          `${playerLabel}: expected at least ${EXPECTED_REMOTES} active RTCPeerConnections`,
        ).toBeTruthy()
        expect(
          nonConnectedActivePeers.length,
          `${playerLabel}: expected all active RTCPeerConnections connected`,
        ).toBe(0)
      }
    }

    for (let index = 0; index < harness.players.length; index++) {
      const player = harness.players[index]!
      const playerLabel = PLAYER_LABELS[index]!
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
    }
  } catch (error) {
    await harness.attachFailureDiagnostics(error, testInfo)
    throw error
  }
}
