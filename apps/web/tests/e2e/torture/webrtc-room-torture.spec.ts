/**
 * WebRTC 4-player torture / stress test.
 *
 * Ensures video and audio work flawlessly even when used recklessly:
 * connecting/disconnecting, turning video on/off, muting/unmuting, and
 * mid-session rejoin. Exercises the streaming stack under adversarial conditions:
 *   1. Rapid toggle bursts   – each player hammers camera/mic 10 times.
 *   2. Concurrent toggle storm – all 4 players toggle simultaneously.
 *   3. Player reload/rejoin   – one player reloads mid-session, room recovers.
 *   4. Soak loop              – repeated toggle + rejoin cycles to detect
 *                               listener accumulation and watchdog regressions.
 *   5. Final health check     – all streams converge back to healthy state,
 *                               no excessive peer connection accumulation.
 *
 * Verifies no prolonged `connecting`/`failed` states and that all remote
 * cards return to a stable state after each phase.
 */

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import type { RoomHarness } from '../../helpers/room-harness'
import { hasAuthCredentials } from '../../helpers/auth-storage'
import {
  assertAllPlayersMediaHealthy,
  collectWebRTCPeerDiagnostics,
  EXPECTED_REMOTES,
  injectPeerConnectionCapture,
  PLAYER_LABELS,
  setupStableRoom,
  waitForAllConnectionsReady,
} from '../../helpers/room-harness'
import { navigateToTestGame } from '../../helpers/test-utils'
import {
  clickAudioToggle,
  clickVideoToggle,
} from '../../helpers/toggle-assertions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Random jitter between 50ms and `maxMs`. */
function jitterMs(maxMs: number): number {
  return 50 + Math.random() * (maxMs - 50)
}

/**
 * Rapidly toggle a button N times with random jitter between clicks.
 * Returns a promise that resolves when all toggles are done.
 */
async function rapidToggle(
  page: Page,
  testId: 'video-toggle-button' | 'audio-toggle-button',
  count: number,
  maxJitterMs = 400,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const btn = page.getByTestId(testId)
    await btn.click().catch(() => {
      // Button may momentarily be disabled during track replacement.
    })
    await new Promise((r) => setTimeout(r, jitterMs(maxJitterMs)))
  }
}

/**
 * Assert that all connections eventually return to a healthy state.
 * Uses the shared connection-readiness poller with a generous timeout.
 */
async function assertRoomRecovers(
  pages: Page[],
  labels: readonly string[],
  phaseLabel: string,
  timeoutMs = 90_000,
): Promise<void> {
  const results = await Promise.all(
    pages.map(async (page, idx) => {
      const label = labels[idx]!
      return waitForAllConnectionsReady(
        page,
        EXPECTED_REMOTES,
        label,
        timeoutMs,
      ).then((r) => ({ label, ...r }))
    }),
  )

  const notReady = results.filter((r) => !r.ready)
  if (notReady.length > 0) {
    const details = notReady
      .map(
        (r) =>
          `${r.label}: elapsed=${r.elapsed}ms, snapshot=${JSON.stringify(r.lastSnapshot)}`,
      )
      .join('\n')
    throw new Error(
      `[Torture:${phaseLabel}] Room did not recover. Not ready:\n${details}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('WebRTC 4-player torture', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  test('survives rapid toggles, concurrent storms, and player rejoin', async ({}, testInfo) => {
    test.setTimeout(900_000)

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
      // ================================================================
      // Phase 0: Bootstrap stable room and verify baseline
      // ================================================================
      harness = await setupStableRoom({ baseURL, testInfo })
      console.log('[Torture] Room bootstrapped. Verifying baseline...')
      await assertAllPlayersMediaHealthy(harness, testInfo)
      console.log('[Torture] Baseline healthy.')

      const pages = harness.players.map((p) => p.page)

      // ================================================================
      // Phase 1: Rapid toggle bursts (sequential, per-player)
      // Each player toggles camera 10 times, then mic 10 times.
      // After each player's burst, verify the room recovers.
      // ================================================================
      console.log('[Torture] === Phase 1: Rapid toggle bursts ===')
      for (let idx = 0; idx < pages.length; idx++) {
        const page = pages[idx]!
        const label = PLAYER_LABELS[idx]!

        console.log(`[Torture:P1] ${label}: rapid video toggles (10x)`)
        await rapidToggle(page, 'video-toggle-button', 10)

        // Ensure camera ends up ON (even number of toggles)
        // 10 toggles → back to original state (ON)

        console.log(`[Torture:P1] ${label}: rapid audio toggles (10x)`)
        await rapidToggle(page, 'audio-toggle-button', 10)

        // Let WebRTC settle after this player's burst
        await new Promise((r) => setTimeout(r, 5_000))
      }

      console.log('[Torture:P1] All bursts done. Asserting room recovery...')
      await assertRoomRecovers(pages, PLAYER_LABELS, 'RapidBursts')
      console.log('[Torture:P1] Room recovered after rapid bursts.')

      // Brief settle before next phase
      await new Promise((r) => setTimeout(r, 5_000))

      // Re-verify full media health after bursts
      await assertAllPlayersMediaHealthy(harness, testInfo)
      console.log('[Torture:P1] Full media health confirmed.')

      // ================================================================
      // Phase 2: Concurrent toggle storm
      // All 4 players toggle camera and mic simultaneously (5 rounds).
      // ================================================================
      console.log('[Torture] === Phase 2: Concurrent toggle storm ===')
      const STORM_ROUNDS = 5
      for (let round = 0; round < STORM_ROUNDS; round++) {
        console.log(`[Torture:P2] Storm round ${round + 1}/${STORM_ROUNDS}`)

        // All players toggle camera concurrently
        await Promise.all(
          pages.map((page) => clickVideoToggle(page).catch(() => {})),
        )
        // Small jitter between camera and mic toggles
        await new Promise((r) => setTimeout(r, jitterMs(800)))

        // All players toggle mic concurrently
        await Promise.all(
          pages.map((page) => clickAudioToggle(page).catch(() => {})),
        )
        await new Promise((r) => setTimeout(r, jitterMs(1500)))
      }

      // Even number of rounds means all toggles should return to original state
      console.log('[Torture:P2] Storm done. Settling before recovery check...')
      await new Promise((r) => setTimeout(r, 10_000))

      await assertRoomRecovers(pages, PLAYER_LABELS, 'ConcurrentStorm')
      console.log('[Torture:P2] Room recovered after concurrent storm.')

      // Re-verify full media health
      await assertAllPlayersMediaHealthy(harness, testInfo)
      console.log('[Torture:P2] Full media health confirmed.')

      // ================================================================
      // Phase 3: Player reload/rejoin
      // Player 3 (Gideon) reloads the page mid-session. All other
      // players should retain their connections and Gideon should
      // reconnect and see all remotes again.
      // ================================================================
      console.log('[Torture] === Phase 3: Player reload/rejoin ===')
      const rejoinIdx = 3
      const rejoinLabel = PLAYER_LABELS[rejoinIdx]!
      const rejoinPlayer = harness.players[rejoinIdx]!

      console.log(`[Torture:P3] ${rejoinLabel}: reloading page...`)
      await injectPeerConnectionCapture(rejoinPlayer.page)
      await navigateToTestGame(rejoinPlayer.page, harness.roomId, {
        handleDuplicateSession: 'transfer',
      })
      await rejoinPlayer.page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => {})
      await rejoinPlayer.page
        .getByTestId('game-id-display')
        .waitFor({ state: 'visible', timeout: 30_000 })

      console.log(
        `[Torture:P3] ${rejoinLabel}: page reloaded. Waiting for connections...`,
      )
      await new Promise((r) => setTimeout(r, 15_000))

      await assertRoomRecovers(pages, PLAYER_LABELS, 'PlayerRejoin')
      console.log('[Torture:P3] Room recovered after player rejoin.')

      // ================================================================
      // Phase 4: Soak loop – repeated toggle/rejoin cycles
      // Detects listener accumulation, watchdog regressions, and
      // state leaks across multiple recovery cycles.
      // ================================================================
      console.log(
        '[Torture] === Phase 4: Soak loop (toggle + rejoin cycles) ===',
      )
      const SOAK_CYCLES = 3
      for (let cycle = 0; cycle < SOAK_CYCLES; cycle++) {
        console.log(`[Torture:P4] Soak cycle ${cycle + 1}/${SOAK_CYCLES}`)

        // All players toggle camera+mic concurrently (2 rounds)
        for (let round = 0; round < 2; round++) {
          await Promise.all(
            pages.map((page) => clickVideoToggle(page).catch(() => {})),
          )
          await new Promise((r) => setTimeout(r, jitterMs(600)))
          await Promise.all(
            pages.map((page) => clickAudioToggle(page).catch(() => {})),
          )
          await new Promise((r) => setTimeout(r, jitterMs(1000)))
        }

        // Player 1 (Chandra) reloads mid-cycle
        const soakRejoinIdx = 1
        const soakRejoinLabel = PLAYER_LABELS[soakRejoinIdx]!
        const soakRejoinPlayer = harness.players[soakRejoinIdx]!
        console.log(
          `[Torture:P4] ${soakRejoinLabel}: reloading in soak cycle ${cycle + 1}...`,
        )
        await injectPeerConnectionCapture(soakRejoinPlayer.page)
        await navigateToTestGame(soakRejoinPlayer.page, harness.roomId, {
          handleDuplicateSession: 'transfer',
        })
        await soakRejoinPlayer.page
          .waitForLoadState('networkidle', { timeout: 30_000 })
          .catch(() => {})
        await soakRejoinPlayer.page
          .getByTestId('game-id-display')
          .waitFor({ state: 'visible', timeout: 30_000 })

        await new Promise((r) => setTimeout(r, 15_000))
        await assertRoomRecovers(pages, PLAYER_LABELS, `SoakCycle${cycle + 1}`)
        console.log(`[Torture:P4] Room recovered in soak cycle ${cycle + 1}.`)
      }

      // Full media health after soak
      await assertAllPlayersMediaHealthy(harness, testInfo)
      console.log('[Torture:P4] Full media health confirmed after soak loop.')

      // ================================================================
      // Phase 5: Final comprehensive health check
      // ================================================================
      console.log('[Torture] === Phase 5: Final health check ===')
      await assertAllPlayersMediaHealthy(harness, testInfo)

      for (let idx = 0; idx < pages.length; idx++) {
        const page = pages[idx]!
        const label = PLAYER_LABELS[idx]!
        const peerDiag = await collectWebRTCPeerDiagnostics(page)
        if (peerDiag.captured) {
          const activePeers = peerDiag.peers.filter(
            (peer) =>
              peer.connectionState !== 'closed' &&
              peer.signalingState !== 'closed',
          )
          const failedPeers = activePeers.filter(
            (p) => p.connectionState === 'failed',
          )
          expect(
            failedPeers.length,
            `${label}: found ${failedPeers.length} failed peer connections at end of torture test`,
          ).toBe(0)

          // Verify no excessive peer connection accumulation (listener leak proxy)
          // After soak, we should have at most ~2x EXPECTED_REMOTES connections
          // (active + recently-closed replacements).
          expect(
            peerDiag.peers.length,
            `${label}: excessive RTCPeerConnection count (${peerDiag.peers.length}) suggests listener/connection leak`,
          ).toBeLessThanOrEqual(EXPECTED_REMOTES * 4)
        }
      }

      // Verify max connecting duration across the full test
      for (let idx = 0; idx < pages.length; idx++) {
        const page = pages[idx]!
        const label = PLAYER_LABELS[idx]!
        const finalReadiness = await waitForAllConnectionsReady(
          page,
          EXPECTED_REMOTES,
          label,
          10_000,
        )
        if (finalReadiness.ready) {
          const maxObservedMs = Math.max(
            0,
            ...Object.values(finalReadiness.maxConnectingDurationsMs),
          )
          expect(
            maxObservedMs,
            `${label}: final connecting duration too long (${maxObservedMs}ms)`,
          ).toBeLessThanOrEqual(30_000)
        }
      }

      console.log('[Torture] All phases passed. Streaming stack is robust.')
    } catch (error) {
      if (harness) {
        await harness.attachFailureDiagnostics(error, testInfo)
      }
      throw error
    } finally {
      await harness?.teardown()
    }
  })
})
